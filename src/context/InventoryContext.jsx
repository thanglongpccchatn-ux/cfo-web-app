import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const InventoryContext = createContext();

export const useInventory = () => {
    const context = useContext(InventoryContext);
    if (!context) throw new Error('useInventory must be used within an InventoryProvider');
    return context;
};

export const InventoryProvider = ({ children }) => {
    const [warehouses, setWarehouses] = useState([]);
    const [stocks, setStocks] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [partners, setPartners] = useState([]);
    const [categories, setCategories] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Helper to fetch and handle errors gracefully
            const safeFetch = async (table, select = '*', orderField = 'name') => {
                const { data, error } = await supabase.from(table).select(select).order(orderField);
                if (error) {
                    console.warn(`InventoryContext: Table [${table}] might be missing or inaccessible.`, error);
                    return [];
                }
                return data || [];
            };

            // Fetch Warehouses
            const whData = await safeFetch('inventory_warehouses');
            setWarehouses(whData);

            // Fetch Stocks with Material info
            const { data: stockData, error: sError } = await supabase
                .from('inventory_stocks')
                .select(`
                    *,
                    materials (*)
                `);
            if (sError) console.warn("InventoryContext: inventory_stocks missing.", sError);
            setStocks(stockData || []);

            // Fetch Materials
            const matData = await safeFetch('materials');
            setMaterials(matData);

            // Fetch Partners
            const pData = await safeFetch('partners');
            setPartners(pData);

            // Fetch Categories
            const cData = await safeFetch('material_categories');
            setCategories(cData);

            // Fetch Active Purchase Orders for Inbound
            const { data: poData, error: poError } = await supabase
                .from('purchase_orders')
                .select('*, purchase_order_lines(*)')
                .in('status', ['ordered', 'partial'])
                .order('created_at', { ascending: false });
            if (poError) console.warn("InventoryContext: purchase_orders missing or inaccessible.", poError);
            setPurchaseOrders(poData || []);
        } catch (error) {
            console.error("Lỗi nghiêm trọng trong InventoryContext:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Helper functions for transactions
    const createTransaction = async (receipt, items) => {
        // 1. Insert the receipt (supports DRAFT and CONFIRMED via receipt.status)
        // If status is not provided, default to COMPLETED for backward compatibility
        const targetStatus = receipt.status || 'COMPLETED';
        const finalReceipt = { ...receipt, status: targetStatus };

        const { data: receiptData, error: rError } = await supabase
            .from('inventory_receipts')
            .insert([finalReceipt])
            .select()
            .single();

        if (rError) throw rError;

        // 2. Insert the items
        const itemsWithId = items.map(item => ({ 
            ...item, 
            receipt_id: receiptData.id 
        }));
        
        const { error: iError } = await supabase
            .from('inventory_receipt_items')
            .insert(itemsWithId);
        
        if (iError) {
            await supabase.from('inventory_receipts').delete().match({ id: receiptData.id });
            throw iError;
        }

        // Only process side-effects if it is NOT a draft
        if (targetStatus !== 'DRAFT') {
            await processTransactionSideEffects(finalReceipt, items);
        }

        await fetchData(); // Refresh stocks & POs after transaction
        return receiptData;
    };

    const processTransactionSideEffects = async (receipt, items) => {
        // 3. If linked to a PO, update PO line quantities and status
        if (receipt.po_id && receipt.type === 'IN') {
            for (const item of items) {
                // Find corresponding PO line by material_id
                const { data: poLines } = await supabase
                    .from('purchase_order_lines')
                    .select('*')
                    .eq('po_id', receipt.po_id)
                    .eq('material_id', item.material_id);
                
                if (poLines && poLines.length > 0) {
                    const poLine = poLines[0];
                    const newReceived = Number(poLine.received_qty || 0) + Number(item.quantity);
                    await supabase
                        .from('purchase_order_lines')
                        .update({ received_qty: newReceived })
                        .eq('id', poLine.id);
                }
            }

            // Update overall PO status
            const { data: updatedLines } = await supabase.from('purchase_order_lines').select('*').eq('po_id', receipt.po_id);
            const allDone = (updatedLines || []).every(l => Number(l.received_qty) >= Number(l.ordered_qty));
            await supabase.from('purchase_orders').update({ status: allDone ? 'completed' : 'partial' }).eq('id', receipt.po_id);
        }

        // 4. Integrated Finance Sync: Create expense_materials for Inbound
        if (receipt.type === 'IN' && receipt.partner_id) {
            const { data: partner } = await supabase.from('partners').select('name').eq('id', receipt.partner_id).single();
            const { data: warehouse } = await supabase.from('inventory_warehouses').select('project_id').eq('id', receipt.warehouse_id).single();
            
            for (const item of items) {
                const mat = materials.find(m => m.id === item.material_id);
                const lineTotal = Number(item.quantity) * Number(item.price || 0) * (1 + Number(mat?.vat_rate || 8) / 100);
                
                await supabase.from('expense_materials').insert([{
                    project_id: warehouse?.project_id || null,
                    supplier_id: receipt.partner_id,
                    supplier_name: partner?.name || '',
                    item_group: 'Vật tư nhập kho',
                    product_name: mat?.name || item.notes || 'Vật tư',
                    unit: item.uom || mat?.unit || '',
                    quantity: item.quantity,
                    unit_price: Number(item.price || 0),
                    vat_rate: Number(mat?.vat_rate || 8),
                    total_amount: lineTotal,
                    paid_amount: 0,
                    expense_date: receipt.date || new Date().toISOString().split('T')[0],
                    notes: `Nhập kho từ phiếu ${receipt.number}${receipt.po_id ? ' (PO liên kết)' : ''}`
                }]);
            }
        }
    };

    const confirmTransaction = async (receiptId) => {
        // Fetch receipt and its items
        const { data: receipt, error: rError } = await supabase
            .from('inventory_receipts')
            .select('*')
            .eq('id', receiptId)
            .single();
        if (rError) throw rError;
        
        const { data: items, error: iError } = await supabase
            .from('inventory_receipt_items')
            .select('*')
            .eq('receipt_id', receiptId);
        if (iError) throw iError;

        if (receipt.status !== 'DRAFT') {
            throw new Error('Chỉ có thể xác nhận phiếu DRAFT');
        }

        // Update status to CONFIRMED
        const { error: updateError } = await supabase
            .from('inventory_receipts')
            .update({ status: 'CONFIRMED' })
            .eq('id', receiptId);
        if (updateError) throw updateError;

        // Process side effects
        await processTransactionSideEffects({ ...receipt, status: 'CONFIRMED' }, items);
        
        await fetchData();
        return true;
    };

    const createRequest = async (request, items) => {
        const { data: requestData, error: rError } = await supabase
            .from('inventory_requests')
            .insert([request])
            .select()
            .single();

        if (rError) throw rError;

        const itemsWithId = items.map(item => ({ 
            ...item, 
            request_id: requestData.id 
        }));
        
        const { error: iError } = await supabase
            .from('inventory_request_items')
            .insert(itemsWithId);
        
        if (iError) {
            await supabase.from('inventory_requests').delete().match({ id: requestData.id });
            throw iError;
        }

        await fetchData();
        return requestData;
    };

    const value = {
        warehouses,
        stocks,
        materials,
        partners,
        categories,
        purchaseOrders,
        loading,
        refreshData: fetchData,
        createTransaction,
        confirmTransaction,
        createRequest
    };

    return (
        <InventoryContext.Provider value={value}>
            {children}
        </InventoryContext.Provider>
    );
};

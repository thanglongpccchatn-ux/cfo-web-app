// Constants for PDF styling
const primaryColor = [16, 185, 129]; // Emerald 500
const textColor = [51, 65, 85]; // Slate 700

export const exportReceiptToPDF = async (receipt, items, materials, partners, warehouses) => {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    
    const doc = new jsPDF();
    
    const partner = partners.find(p => p.id === receipt.partner_id);
    const warehouse = warehouses.find(w => w.id === receipt.warehouse_id);

    // Header
    doc.setFontSize(22);
    doc.setTextColor(...primaryColor);
    doc.text(receipt.type === 'IN' ? 'PHIEU NHAP KHO' : 'PHIEU XUAT KHO', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`So: ${receipt.number}`, 105, 28, { align: 'center' });
    doc.text(`Ngay: ${new Date(receipt.date).toLocaleDateString('vi-VN')}`, 105, 34, { align: 'center' });
    
    // Info Section
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    
    let y = 50;
    doc.text(`Trang thai: ${receipt.status}`, 14, y); y += 8;
    doc.text(`Kho: ${warehouse?.name || '---'} (DA: ${warehouse?.project_id || '---'})`, 14, y); y += 8;
    if (receipt.type === 'IN') {
        doc.text(`Nha cung cap: ${partner?.name || '---'}`, 14, y); y += 8;
    } else {
        doc.text(`Don vi nhan: ${partner?.name || '---'}`, 14, y); y += 8;
        if (receipt.sub_type) {
            doc.text(`Ly do: ${receipt.sub_type}`, 14, y); y += 8;
        }
    }
    doc.text(`Ghi chu: ${receipt.notes || 'Khong'}`, 14, y); y += 12;

    // Items Table
    const tableData = items.map((item, index) => {
        const mat = materials.find(m => m.id === item.material_id);
        const uom = item.uom || mat?.unit || '';
        
        if (receipt.type === 'IN') {
            const price = Number(item.price || 0);
            const total = Number(item.quantity) * price;
            return [
                index + 1,
                mat?.name || 'Vat tu khong xac dinh',
                uom,
                Number(item.quantity).toLocaleString('vi-VN'),
                price.toLocaleString('vi-VN'),
                total.toLocaleString('vi-VN')
            ];
        } else {
            return [
                index + 1,
                mat?.name || 'Vat tu khong xac dinh',
                uom,
                Number(item.quantity).toLocaleString('vi-VN')
            ];
        }
    });

    const head = receipt.type === 'IN' 
        ? [['STT', 'Ten Vat Tu', 'DVT', 'So Luong', 'Don Gia', 'Thanh Tien']]
        : [['STT', 'Ten Vat Tu', 'DVT', 'So Luong']];

    doc.autoTable({
        startY: y,
        head: head,
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
        styles: { font: 'helvetica', fontSize: 10 },
        columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 30, halign: 'right' },
            4: { cellWidth: 30, halign: 'right' },
            5: { cellWidth: 30, halign: 'right' },
        }
    });

    // Footer Signatures
    const finalY = doc.lastAutoTable.finalY || y;
    doc.text('Nguoi lap phieu', 40, finalY + 20, { align: 'center' });
    doc.text(receipt.type === 'IN' ? 'Nguoi giao hang' : 'Nguoi nhan hang', 105, finalY + 20, { align: 'center' });
    doc.text('Thu kho', 170, finalY + 20, { align: 'center' });

    doc.setFontSize(9);
    doc.text('(Ky, ho ten)', 40, finalY + 25, { align: 'center' });
    doc.text('(Ky, ho ten)', 105, finalY + 25, { align: 'center' });
    doc.text('(Ky, ho ten)', 170, finalY + 25, { align: 'center' });

    // Save
    doc.save(`${receipt.number}_${new Date().getTime()}.pdf`);
};

export const exportStockToExcel = async (stocks, materials, warehouses) => {
    const XLSX = await import('xlsx');
    
    // Generate data array
    const data = stocks.map(stock => {
        const mat = materials.find(m => m.id === stock.material_id) || {};
        const wh = warehouses.find(w => w.id === stock.warehouse_id) || {};
        const qty = Number(stock.quantity);
        const avgPrice = Number(mat.avg_unit_price || mat.price || 0);
        
        return {
            'Kho': wh.name || '---',
            'Dự Án': wh.project_id || '---',
            'Mã Vật Tư': mat.id?.substring(0,8) || '---',
            'Tên Vật Tư': mat.name || '---',
            'Danh Mục': mat.category || '---',
            'ĐVT': mat.unit || '---',
            'Số Lượng Tồn': qty,
            'Đơn Giá BQ': avgPrice,
            'Tổng Giá Trị': qty * avgPrice,
            'Mức cảnh báo': Number(stock.min_quantity || 0),
            'Tình trạng': qty <= Number(stock.min_quantity || 0) ? 'Sắp hết' : 'An toàn'
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ton Kho");

    // Format headers and widths automatically
    const wscols = [
        {wch: 25}, {wch: 15}, {wch: 15}, {wch: 40}, {wch: 20},
        {wch: 10}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 15}, {wch: 15}
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `Bao_Cao_Ton_Kho_${new Date().toISOString().split('T')[0]}.xlsx`);
};

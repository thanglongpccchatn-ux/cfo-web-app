import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { smartToast } from '../utils/globalToast';
import { fmt } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

const IN_CATEGORIES = [
    { value: 'Thu từ dự án', label: 'Thu từ dự án (Thanh toán, Quyết toán)' },
    { value: 'Bán phế liệu, thanh lý', label: 'Bán phế liệu, vật tư dư (Thu nhập khác)' },
    { value: 'Lãi tiền gửi', label: 'Lãi tiền gửi ngân hàng' },
    { value: 'Thu nhập khác', label: 'Các khoản thu nhập khác' },
    { value: 'Khác', label: 'Khác (Không rõ)' }
];

const OUT_CATEGORIES = [
    { value: 'Chi phí chung', label: 'Chi phí chung (Vận hành, Kế toán)' },
    { value: 'Chi công trường', label: 'Chi công trường (Nhân công, vật tư, BCH)' },
    { value: 'Chi Nhà cung cấp', label: 'Chi trả Nhà cung cấp / Vật tư' },
    { value: 'Chi Thầu phụ', label: 'Chi trả Thầu phụ / Tổ đội' },
    { value: 'Chi Lương/Nội bộ', label: 'Chi Lương, Thưởng, Nội bộ' },
    { value: 'Chi khác', label: 'Các khoản chi khác' }
];

export default function TreasuryManagement() {
    const { profile, hasPermission } = useAuth();
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [showTxModal, setShowTxModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null); // account being edited
    const [txType, setTxType] = useState('IN'); // 'IN', 'OUT', 'TRANSFER'
    const [filterAccount, setFilterAccount] = useState('all');
    
    // Account form
    const [accForm, setAccForm] = useState({ name: '', bank_name: '', account_number: '', type: 'bank', initial_balance: '', status: 'active' });
    const [isSubmittingAcc, setIsSubmittingAcc] = useState(false);

    // TX form
    const [txForm, setTxForm] = useState({ 
        account_id: '', 
        to_account_id: '', // for transfer
        amount: '', 
        category: '', 
        party_name: '', // Người nộp / Người nhận (Tên NCC, NV...)
        planned_date: '', // Ngày đề nghị / Kế hoạch
        transaction_date: new Date().toISOString().split('T')[0], 
        description: '', 
        project_id: '' 
    });
    const [isSubmittingTx, setIsSubmittingTx] = useState(false);

    const queryClient = useQueryClient();

    // ── Queries ──
    const { data: accounts = [], isLoading: loadingAcc } = useQuery({
        queryKey: ['treasuryAccounts'],
        queryFn: async () => {
            const { data, error } = await supabase.from('treasury_accounts').select('*').order('type').order('name');
            if (error) throw error;
            return data || [];
        }
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['treasuryProjects'],
        queryFn: async () => {
            const { data } = await supabase.from('projects').select('id, name, code, internal_code');
            return data || [];
        }
    });

    const { data: suggestions = [] } = useQuery({
        queryKey: ['partySuggestions'],
        queryFn: async () => {
            const [supRes, subRes, partRes, txRes] = await Promise.all([
                supabase.from('suppliers').select('name'),
                supabase.from('subcontractors').select('name'),
                supabase.from('partners').select('name'),
                supabase.from('treasury_transactions').select('party_name').not('party_name', 'is', null)
            ]);
            
            const names = new Set();
            if (supRes.data) supRes.data.forEach(x => names.add(x.name));
            if (subRes.data) subRes.data.forEach(x => names.add(x.name));
            if (partRes.data) partRes.data.forEach(x => names.add(x.name));
            if (txRes.data) txRes.data.forEach(x => names.add(x.party_name));
            
            return Array.from(names).filter(Boolean).sort();
        }
    });

    const { data: transactions = [], isLoading: loadingTx } = useQuery({
        queryKey: ['treasuryTransactions', filterAccount],
        queryFn: async () => {
            let q = supabase.from('treasury_transactions')
                .select('*, treasury_accounts(name, type), projects(name, code), auth.users!treasury_transactions_created_by_fkey(raw_user_meta_data)')
                .order('transaction_date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(200);
                
            if (filterAccount !== 'all') {
                q = q.eq('account_id', filterAccount);
            }
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        }
    });

    // ── Handlers ──
    const handleNumChange = (field, value, isAcc = false) => {
        const clean = value.replace(/[^0-9]/g, '');
        if (isAcc) setAccForm(prev => ({ ...prev, [field]: clean }));
        else setTxForm(prev => ({ ...prev, [field]: clean }));
    };

    const handleSaveAccount = async (e) => {
        e.preventDefault();
        setIsSubmittingAcc(true);
        try {
            if (editingAccount) {
                // Update existing account
                const payload = {
                    name: accForm.name,
                    bank_name: accForm.bank_name || null,
                    account_number: accForm.account_number || null,
                    type: accForm.type,
                    current_balance: Number(accForm.initial_balance) || 0,
                    status: accForm.status
                };
                const { error } = await supabase.from('treasury_accounts').update(payload).eq('id', editingAccount.id);
                if (error) throw error;
                smartToast('Cập nhật sổ quỹ thành công!');
            } else {
                const payload = {
                    name: accForm.name,
                    bank_name: accForm.bank_name || null,
                    account_number: accForm.account_number || null,
                    type: accForm.type,
                    initial_balance: Number(accForm.initial_balance) || 0,
                    current_balance: Number(accForm.initial_balance) || 0,
                    status: accForm.status
                };
                const { error } = await supabase.from('treasury_accounts').insert([payload]);
                if (error) throw error;
                smartToast('Tạo sổ quỹ thành công!');
            }
            setShowAccountModal(false);
            setEditingAccount(null);
            setAccForm({ name: '', bank_name: '', account_number: '', type: 'bank', initial_balance: '', status: 'active' });
            queryClient.invalidateQueries({ queryKey: ['treasuryAccounts'] });
        } catch (err) {
            smartToast('Lỗi: ' + err.message);
        } finally {
            setIsSubmittingAcc(false);
        }
    };

    const openEditAccount = (acc) => {
        setEditingAccount(acc);
        setAccForm({
            name: acc.name,
            bank_name: acc.bank_name || '',
            account_number: acc.account_number || '',
            type: acc.type,
            initial_balance: String(acc.current_balance || 0),
            status: acc.status || 'active'
        });
        setShowAccountModal(true);
    };

    const handleSaveTransaction = async (e) => {
        e.preventDefault();
        setIsSubmittingTx(true);
        try {
            const amount = Number(txForm.amount);
            if (!amount || amount <= 0) throw new Error('Số tiền phải lớn hơn 0');

            if (txType === 'TRANSFER') {
                if (txForm.account_id === txForm.to_account_id) throw new Error('Quỹ nguồn và Quỹ nhận phải khác nhau');
                if (!txForm.account_id || !txForm.to_account_id) throw new Error('Vui lòng chọn 2 quỹ');
                
                const outTxId = crypto.randomUUID();
                const inTxId = crypto.randomUUID();
                const ts = txForm.transaction_date;

                const outPayload = {
                    id: outTxId,
                    account_id: txForm.account_id,
                    type: 'OUT',
                    amount: amount,
                    category: 'Chuyển tiền nội bộ',
                    party_name: 'Nội bộ',
                    transaction_date: ts,
                    description: txForm.description || 'Chuyển quỹ nội bộ',
                    created_by: profile?.id,
                    linked_transaction_id: inTxId,
                    planned_date: txForm.planned_date || null
                };
                const inPayload = {
                    id: inTxId,
                    account_id: txForm.to_account_id,
                    type: 'IN',
                    amount: amount,
                    category: 'Chuyển tiền nội bộ',
                    party_name: 'Nội bộ',
                    transaction_date: ts,
                    description: txForm.description || 'Nhận tiền nội bộ',
                    created_by: profile?.id,
                    linked_transaction_id: outTxId,
                    planned_date: txForm.planned_date || null
                };

                const { error } = await supabase.from('treasury_transactions').insert([outPayload, inPayload]);
                if (error) throw error;

            } else {
                if (!txForm.account_id) throw new Error('Vui lòng chọn quỹ/tài khoản');
                const payload = {
                    account_id: txForm.account_id,
                    type: txType, // IN or OUT
                    amount: amount,
                    category: txForm.category,
                    party_name: txForm.party_name || null,
                    planned_date: txForm.planned_date || null,
                    transaction_date: txForm.transaction_date,
                    description: txForm.description,
                    created_by: profile?.id,
                    project_id: txForm.project_id || null
                };
                const { error } = await supabase.from('treasury_transactions').insert([payload]);
                if (error) throw error;
            }

            smartToast('Lưu giao dịch thành công!');
            setShowTxModal(false);
            setTxForm({ account_id: '', to_account_id: '', amount: '', category: '', party_name: '', planned_date: '', transaction_date: new Date().toISOString().split('T')[0], description: '', project_id: '' });
            queryClient.invalidateQueries({ queryKey: ['treasuryTransactions'] });
            queryClient.invalidateQueries({ queryKey: ['treasuryAccounts'] });
        } catch (err) {
            smartToast('Lỗi: ' + err.message);
        } finally {
            setIsSubmittingTx(false);
        }
    };

    const handleDeleteTx = async (tx) => {
        if (!window.confirm('Xóa giao dịch này? Số dư tài khoản sẽ bị hoàn tác. Cẩn thận!')) return;
        try {
            // Delete this transaction. If it's a transfer, also delete the linked one.
            if (tx.linked_transaction_id) {
                await supabase.from('treasury_transactions').delete().in('id', [tx.id, tx.linked_transaction_id]);
            } else {
                await supabase.from('treasury_transactions').delete().eq('id', tx.id);
            }
            smartToast('Đã xóa giao dịch và hoàn tác số dư');
            queryClient.invalidateQueries({ queryKey: ['treasuryTransactions'] });
            queryClient.invalidateQueries({ queryKey: ['treasuryAccounts'] });
        } catch (err) {
            smartToast('Lỗi: ' + err.message);
        }
    };

    // ── Derived State ──
    const totalBank = accounts.filter(a => a.type === 'bank').reduce((sum, a) => sum + Number(a.current_balance), 0);
    const totalCash = accounts.filter(a => a.type === 'cash').reduce((sum, a) => sum + Number(a.current_balance), 0);
    const totalAll = totalBank + totalCash;

    const inp = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all";

    return (
        <div className="space-y-6 animate-fade-in p-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                        <span className="material-symbols-outlined text-4xl text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded-2xl">account_balance_wallet</span>
                        Sổ Quỹ & Ngân hàng
                    </h2>
                    <p className="text-sm text-slate-500 mt-2 font-medium">Quản lý dòng tiền vào/ra, số dư đa tài khoản công ty thực tế.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowAccountModal(true)} className="h-12 flex items-center gap-2 px-5 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all">
                        <span className="material-symbols-outlined">add_card</span> Thêm Sổ Quỹ
                    </button>
                    <button onClick={() => { setTxType('TRANSFER'); setShowTxModal(true); setTxForm(prev => ({...prev, category: 'Chuyển quỹ nội bộ'})); }} className="h-12 flex items-center gap-2 px-5 bg-indigo-50 border-2 border-indigo-100 text-indigo-700 font-bold rounded-2xl hover:bg-indigo-100 transition-all">
                        <span className="material-symbols-outlined">sync_alt</span> Chuyển Quỹ
                    </button>
                    <button onClick={() => { setTxType('OUT'); setShowTxModal(true); setTxForm(prev => ({...prev, category: OUT_CATEGORIES[0].value})); }} className="h-12 flex items-center gap-2 px-5 bg-rose-50 border-2 border-rose-200 text-rose-700 font-bold rounded-2xl hover:bg-rose-100 transition-all">
                        <span className="material-symbols-outlined">money_off</span> Chi ra
                    </button>
                    <button onClick={() => { setTxType('IN'); setShowTxModal(true); setTxForm(prev => ({...prev, category: IN_CATEGORIES[0].value})); }} className="h-12 flex items-center gap-2 px-6 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 transition-transform active:scale-95">
                        <span className="material-symbols-outlined">payments</span> Thu vào
                    </button>
                </div>
            </div>

            {/* Dashboard Accounts */}
            <div className="space-y-4">
                <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <p className="text-emerald-200 uppercase tracking-widest text-[10px] font-black mb-1">TỔNG TỒN QUỸ CÔNG TY</p>
                            <h3 className="text-3xl lg:text-4xl font-black tracking-tight">{fmt(totalAll)}<span className="text-xl ml-1 text-emerald-400">₫</span></h3>
                        </div>
                        <div className="flex gap-6 bg-black/20 px-4 py-3 rounded-2xl backdrop-blur-md text-sm">
                            <div>
                                <p className="text-emerald-200/80 text-[9px] font-bold uppercase mb-0.5 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">account_balance</span>Ngân hàng</p>
                                <p className="text-base font-bold">{fmt(totalBank)}</p>
                            </div>
                            <div className="w-px bg-white/10"></div>
                            <div>
                                <p className="text-emerald-200/80 text-[9px] font-bold uppercase mb-0.5 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">point_of_sale</span>Tiền mặt</p>
                                <p className="text-base font-bold text-amber-300">{fmt(totalCash)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-1">
                    {accounts.map(acc => (
                        <div key={acc.id} onClick={() => openEditAccount(acc)} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm hover:border-emerald-400 transition-all cursor-pointer group flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className={`material-symbols-outlined text-[16px] ${acc.type === 'bank' ? 'text-blue-500' : 'text-amber-500'}`}>
                                    {acc.type === 'bank' ? 'account_balance' : 'point_of_sale'}
                                </span>
                                <h4 className="font-bold text-xs text-slate-800 truncate flex-1" title={acc.name}>{acc.name}</h4>
                                <span className="material-symbols-outlined text-[12px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                            </div>
                            {acc.type === 'bank' && <p className="text-[9px] text-slate-400 font-mono truncate mb-0.5">{acc.bank_name} · {acc.account_number}</p>}
                            <p className={`text-sm font-black ${Number(acc.current_balance) < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{fmt(acc.current_balance)}<span className="text-[10px] text-slate-400 ml-0.5">₫</span></p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Transactions Ledger */}
            <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-black tracking-tight text-lg text-slate-800 flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400">history</span> Lịch sử Giao dịch
                    </h3>
                    <select 
                        value={filterAccount} 
                        onChange={e => setFilterAccount(e.target.value)}
                        className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-sm"
                    >
                        <option value="all">Tất cả sổ quỹ</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-slate-400 text-[10px] uppercase font-black tracking-widest">
                            <tr>
                                <th className="px-4 py-3 border-b border-slate-100">Ngày ĐN</th>
                                <th className="px-4 py-3 border-b border-slate-100">Ngày GD</th>
                                <th className="px-4 py-3 border-b border-slate-100">Nội dung / Đối tượng</th>
                                <th className="px-4 py-3 border-b border-slate-100">DA / Loại</th>
                                <th className="px-4 py-3 border-b border-slate-100 text-right">Biến động</th>
                                <th className="px-4 py-3 border-b border-slate-100">Sổ Quỹ</th>
                                <th className="px-4 py-3 border-b border-slate-100 text-center w-12"><span className="material-symbols-outlined text-[14px]">settings</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loadingTx ? (
                                <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-400 font-medium animate-pulse">Đang tải lịch sử...</td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-400 font-medium">Chưa có giao dịch nào</td></tr>
                            ) : transactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-slate-50/50 group transition-colors">
                                    <td className="px-4 py-3 font-mono text-[10px] text-slate-400 whitespace-nowrap">{tx.planned_date ? new Date(tx.planned_date).toLocaleDateString('vi-VN') : <span className="text-slate-200">—</span>}</td>
                                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-500 whitespace-nowrap">{new Date(tx.transaction_date).toLocaleDateString('vi-VN')}</td>
                                    <td className="px-4 py-3">
                                        <p className="font-bold text-slate-800 text-xs line-clamp-1" title={tx.description}>{tx.description || '-'}</p>
                                        {tx.party_name && (
                                            <p className="text-[11px] font-bold text-slate-600 mt-1 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">{tx.type === 'IN' ? 'person_add' : 'person'}</span>
                                                Đối tượng: {tx.party_name}
                                            </p>
                                        )}
                                        {tx.auth?.users?.raw_user_meta_data?.full_name && <p className="text-[10px] text-slate-400 italic mt-0.5">nhập bởi {tx.auth.users.raw_user_meta_data.full_name}</p>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-1.5 items-start">
                                            <span className="inline-flex text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                {tx.category}
                                            </span>
                                            {tx.projects && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200 mt-1" title={tx.projects.name}>
                                                    {tx.projects.internal_code || tx.projects.code}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {tx.type === 'IN' ? (
                                            <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block">+ {fmt(tx.amount)}</span>
                                        ) : (
                                            <span className="font-black text-rose-600 bg-rose-50 px-2 py-1 rounded inline-block">- {fmt(tx.amount)}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-2 h-2 rounded-full ${tx.treasury_accounts?.type === 'bank' ? 'bg-blue-500' : 'bg-amber-400'}`}></span>
                                            <span className="font-bold text-slate-600 text-xs">{tx.treasury_accounts?.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button onClick={() => handleDeleteTx(tx)} className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100 p-2">
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL: Thêm / Sửa Sổ Quỹ */}
            {showAccountModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => { setShowAccountModal(false); setEditingAccount(null); }}>
                    <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl p-8 animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{editingAccount ? 'Sửa Sổ Quỹ' : 'Thêm Sổ Quỹ'}</h3>
                            <button onClick={() => { setShowAccountModal(false); setEditingAccount(null); }} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><span className="material-symbols-outlined text-[18px]">close</span></button>
                        </div>
                        <form onSubmit={handleSaveAccount} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Lưu trữ quỹ ở dạng</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button type="button" onClick={() => setAccForm({...accForm, type: 'bank'})} className={`py-3 rounded-2xl font-bold border-2 transition-all ${accForm.type === 'bank' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-400'}`}>Ngân hàng</button>
                                    <button type="button" onClick={() => setAccForm({...accForm, type: 'cash'})}  className={`py-3 rounded-2xl font-bold border-2 transition-all ${accForm.type === 'cash' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-100 text-slate-400'}`}>Két Tiền Mặt</button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tên sổ quỹ (Tên gợi nhớ)*</label>
                                <input required placeholder="VD: Quỹ Hà Nội, TCB Sateco..." value={accForm.name} onChange={e => setAccForm({...accForm, name: e.target.value})} className={inp} />
                            </div>
                            {accForm.type === 'bank' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tên Ngân hàng</label>
                                        <input placeholder="Vietcombank..." value={accForm.bank_name} onChange={e => setAccForm({...accForm, bank_name: e.target.value})} className={inp} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Số Tài khoản</label>
                                        <input placeholder="1903..." value={accForm.account_number} onChange={e => setAccForm({...accForm, account_number: e.target.value})} className={inp} />
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                                    {editingAccount ? 'Số dư hiện tại (Cập nhật thủ công)' : 'Số dư đầu kỳ (Lúc nhập lên app)'}
                                </label>
                                <div className="relative">
                                    <input required placeholder="0" value={fmt(accForm.initial_balance)} onChange={e => handleNumChange('initial_balance', e.target.value, true)} className={`${inp} pr-12 font-black text-lg`} />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">VNĐ</span>
                                </div>
                            </div>
                            <button type="submit" disabled={isSubmittingAcc} className="w-full py-4 mt-2 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 disabled:opacity-50">
                                {editingAccount ? 'Lưu thay đổi' : 'Lưu thông tin Quỹ'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Thêm Giao dịch */}
            {showTxModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowTxModal(false)}>
                    <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl p-8 animate-slide-down" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className={`text-2xl font-black tracking-tight flex items-center gap-2 ${txType === 'IN' ? 'text-emerald-600' : txType === 'OUT' ? 'text-rose-600' : 'text-indigo-600'}`}>
                                <span className={`material-symbols-outlined p-2 rounded-2xl text-white ${txType === 'IN' ? 'bg-emerald-500' : txType === 'OUT' ? 'bg-rose-500' : 'bg-indigo-500'}`}>
                                    {txType === 'IN' ? 'add' : txType === 'OUT' ? 'remove' : 'sync_alt'}
                                </span>
                                {txType === 'IN' ? 'Lập Phiếu Thu' : txType === 'OUT' ? 'Lập Phiếu Chi' : 'Điều chuyển Nội bộ'}
                            </h3>
                            <button onClick={() => setShowTxModal(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><span className="material-symbols-outlined text-[18px]">close</span></button>
                        </div>
                        <form onSubmit={handleSaveTransaction} className="space-y-4">
                            {txType === 'TRANSFER' ? (
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100 relative">
                                    <div>
                                        <label className="block text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5 ml-1">Rút từ Quỹ (Nguồn)</label>
                                        <select required value={txForm.account_id} onChange={e => setTxForm({...txForm, account_id: e.target.value})} className="w-full bg-white border border-slate-200 rounded-2xl px-3 py-3 text-sm font-bold focus:ring-2 focus:ring-rose-500 outline-none">
                                            <option value="">Chọn quỹ rút...</option>
                                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (Dư {fmt(a.current_balance)})</option>)}
                                        </select>
                                    </div>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shadow font-bold mt-1 z-10 border-2 border-white">
                                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5 ml-1">Nhập vào Quỹ (Đích)</label>
                                        <select required value={txForm.to_account_id} onChange={e => setTxForm({...txForm, to_account_id: e.target.value})} className="w-full bg-white border border-slate-200 rounded-2xl px-3 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none">
                                            <option value="">Chọn quỹ nhận...</option>
                                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className={`block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 ${txType === 'IN' ? 'text-emerald-500' : 'text-rose-500'}`}>Tài khoản / Sổ quỹ thao tác*</label>
                                    <select required value={txForm.account_id} onChange={e => setTxForm({...txForm, account_id: e.target.value})} className={inp}>
                                        <option value="">Chọn tài khoản...</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (Số dư: {fmt(a.current_balance)})</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Ngày đề nghị</label>
                                    <input type="date" value={txForm.planned_date} onChange={e => setTxForm({...txForm, planned_date: e.target.value})} className={inp} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Ngày thực chi</label>
                                    <input type="date" required value={txForm.transaction_date} onChange={e => setTxForm({...txForm, transaction_date: e.target.value})} className={inp} />
                                </div>
                                {txType !== 'TRANSFER' && (
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Phân loại</label>
                                            <select required value={txForm.category} onChange={e => setTxForm({...txForm, category: e.target.value})} className={inp}>
                                                {(txType === 'IN' ? IN_CATEGORIES : OUT_CATEGORIES).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                            </select>
                                        </div>
                                )}
                            </div>

                            {txType !== 'TRANSFER' && (
                                <div>
                                    <label className={`block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 ${txType === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {txType === 'IN' ? 'Người / Đơn vị nộp tiền' : 'Người / Đơn vị nhận tiền (NCC, Thầu phụ...)'}
                                    </label>
                                    <input 
                                        list="party_suggestions" 
                                        placeholder={txType === 'IN' ? "Chọn từ danh sách hoặc Gõ tên mới..." : "Chọn NCC/Thầu phụ hoặc Gõ người nhận mới..."} 
                                        value={txForm.party_name} 
                                        onChange={e => setTxForm({...txForm, party_name: e.target.value})} 
                                        className={inp} 
                                    />
                                    <datalist id="party_suggestions">
                                        {suggestions.map(s => <option key={s} value={s} />)}
                                    </datalist>
                                </div>
                            )}

                            <div>
                                <label className={`block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 ${txType === 'IN' ? 'text-emerald-600' : txType === 'OUT' ? 'text-rose-600' : 'text-indigo-600'}`}>
                                    Mệnh giá (Số tiền)*
                                </label>
                                <div className="relative">
                                    <input required placeholder="0" value={fmt(txForm.amount)} onChange={e => handleNumChange('amount', e.target.value)} className={`w-full bg-slate-50 dark:bg-slate-900 border-2 rounded-2xl px-4 py-4 pr-12 text-2xl font-black focus:outline-none transition-all ${txType === 'IN' ? 'border-emerald-200 text-emerald-600 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10' : txType === 'OUT' ? 'border-rose-200 text-rose-600 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10' : 'border-indigo-200 text-indigo-600 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} />
                                    <span className={`absolute right-4 top-1/2 -translate-y-1/2 font-black ${txType === 'IN' ? 'text-emerald-300' : txType === 'OUT' ? 'text-rose-300' : 'text-indigo-300'}`}>VNĐ</span>
                                </div>
                            </div>
                            
                            {txType !== 'TRANSFER' && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Gắn liền với Dự án (Nếu có ghi nhận doanh thu / chi phí DA)</label>
                                    <select value={txForm.project_id} onChange={e => setTxForm({...txForm, project_id: e.target.value})} className={inp}>
                                        <option value="">-- Không phân bổ (Thuộc Công ty) --</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.internal_code || p.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Diễn giải</label>
                                <input placeholder="Nhập lý do thu chi..." required value={txForm.description} onChange={e => setTxForm({...txForm, description: e.target.value})} className={inp} />
                            </div>

                            <button type="submit" disabled={isSubmittingTx} className={`w-full py-4 mt-2 text-white font-black rounded-2xl disabled:opacity-50 transition-all ${txType === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20' : txType === 'OUT' ? 'bg-rose-600 hover:bg-rose-700 shadow-xl shadow-rose-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-500/20'}`}>
                                Xử lý Giao dịch {txType === 'IN' ? 'THU' : txType === 'OUT' ? 'CHI' : 'CHUYỂN QUỸ'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

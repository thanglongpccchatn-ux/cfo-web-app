import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import * as drive from '../lib/googleDrive';
import SearchableSelect from './common/SearchableSelect';
import {
    formatPrice, parseFormattedNumber, formatInputNumber, fmt, formatBillion,
    inputBase, labelBase, navItems, companyEntities, defaultPartnerForm,
    createDefaultMilestone, calculateAllocations
} from './contract/contractHelpers';

// ─────────────────────────────────────────────────────────
export default function ContractCreate({ onBack, project }) {
    // ── 1. Contract Basic Info ──
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [internalCode, setInternalCode] = useState('');
    const [partnerId, setPartnerId] = useState('');
    const [contractType, setContractType] = useState('Thi công');
    const [contractForm, setContractForm] = useState('Trọn gói');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [paymentTerms, setPaymentTerms] = useState('');
    const [actingEntityKey, setActingEntityKey] = useState('thanglong');
    const [allCompanies, setAllCompanies] = useState([]);
    
    // Banking States
    const [tlBank, setTlBank] = useState({ account: '', name: '', branch: '', holder: '' });
    const [stBank, setStBank] = useState({ account: '', name: '', branch: '', holder: '' });
    const [tpBank, setTpBank] = useState({ account: '', name: '', branch: '', holder: '' });
    const [totalValue, setTotalValue] = useState(0);
    const [totalValueDisplay, setTotalValueDisplay] = useState('');
    const [postVatDisplay, setPostVatDisplay] = useState('');
    const [vat, setVat] = useState(8);
    const [internalVat, setInternalVat] = useState(8);

    // ── 3. Sateco Allocation ──
    const [contractRatio, setContractRatio] = useState(98);
    const [internalDeduction, setInternalDeduction] = useState(0);

    // ── 4. Dates ──
    const [signDate, setSignDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // ── 5. Warranty ──
    const [warrantyRatio, setWarrantyRatio] = useState(5);
    const [warrantyPeriod, setWarrantyPeriod] = useState(24);
    const [hasWarrantyBond, setHasWarrantyBond] = useState(false);
    const [handoverDate, setHandoverDate] = useState('');
    const [warrantySchedule, setWarrantySchedule] = useState([]);
    const [paymentSchedule, setPaymentSchedule] = useState([
        { id: 'ms-1', name: 'Tạm ứng', percentage: 20, amount: 0, condition: 'Sau khi ký hợp đồng', has_guarantee: true, due_days: 7 }
    ]);

    const [editingBank, setEditingBank] = useState(false);
    const [bankLoaded, setBankLoaded] = useState(false);
    const [bankProfiles, setBankProfiles] = useState([]);
    const [selectedBankProfile, setSelectedBankProfile] = useState('');

    // ── Partners ──
    const [partners, setPartners] = useState([]);
    const [isLoadingPartners, setIsLoadingPartners] = useState(false);
    const [showPartnerModal, setShowPartnerModal] = useState(false);
    const [partnerForm, setPartnerForm] = useState({...defaultPartnerForm});

    const [isSaving, setIsSaving] = useState(false);
    const [milestoneBase, setMilestoneBase] = useState('pre_vat'); // 'pre_vat' | 'post_vat'

    // ── CALCULATIONS ──
    const alloc = calculateAllocations(totalValue, vat, contractRatio, internalDeduction);
    const { actualRatio, tl_preVat, tl_vatAmount, tl_postVat, st_invoice_preVat, st_invoice_vat, st_invoice_postVat, st_actual_preVat, st_actual_vat, st_actual_postVat, tl_cutPercent, tl_cutAmount, internalCutAmount } = alloc;
    const warrantyAmount = Math.round(totalValue * (warrantyRatio / 100));

    // Drive integration
    const [isDriveConnected, setIsDriveConnected] = useState(drive.isConnected());
    const [googleDriveFolderId, setGoogleDriveFolderId] = useState(null);

    // ── Data Fetching & Initialization ──
    useEffect(() => {
        fetchPartners();
        fetchBankProfiles();
        if (project) {
            // Initialize from project
            setName(project.name || '');
            setCode(project.code || '');
            setInternalCode(project.internal_code || '');
            setPartnerId(project.partner_id || '');
            setContractType(project.contract_type || 'Thi công');
            setContractForm(project.contract_form || 'Trọn gói');
            setLocation(project.location || '');
            setDescription(project.description || '');
            setPaymentTerms(project.payment_terms || '');
            const initialVal = Number(project.original_value) || 0;
            setTotalValue(initialVal);
            setTotalValueDisplay(formatInputNumber(initialVal));
            const projectVat = project.vat_percentage !== undefined && project.vat_percentage !== null ? Number(project.vat_percentage) : 8;
            setVat(projectVat);
            setPostVatDisplay(formatInputNumber(Math.round(initialVal * (1 + projectVat / 100))));
            setInternalVat(project.internal_vat_percentage !== undefined && project.internal_vat_percentage !== null ? Number(project.internal_vat_percentage) : 8);
            setContractRatio(Number(project.sateco_contract_ratio) || 98);
            setInternalDeduction(Number(project.internal_deduction) || 0);
            setSignDate(project.sign_date || '');
            setStartDate(project.start_date || '');
            setEndDate(project.end_date || '');
            setActingEntityKey(project.acting_entity_key || 'thanglong');
            setWarrantyRatio(Number(project.warranty_percentage) || Number(project.warranty_ratio) || 5);
            setWarrantyPeriod(Number(project.warranty_duration_months) || Number(project.warranty_period_months) || 24);
            setHasWarrantyBond(!!project.has_warranty_guarantee || !!project.has_warranty_bond);
            setHandoverDate(project.handover_date || '');
            setWarrantySchedule(project.warranty_schedule || []);
            const initialPaymentSchedule = project.payment_schedule && project.payment_schedule.length > 0 
                ? project.payment_schedule 
                : [{ id: 'ms-' + Date.now(), name: 'Tạm ứng', percentage: 20, amount: 0, condition: 'Sau khi ký hợp đồng', has_guarantee: true }];
            setPaymentSchedule(initialPaymentSchedule);
            if (initialPaymentSchedule[0].base_type) {
                setMilestoneBase(initialPaymentSchedule[0].base_type);
            } else {
                setMilestoneBase('pre_vat');
            }
            setGoogleDriveFolderId(project.google_drive_folder_id || null);
            
            setTlBank({
                account: project.tl_bank_account || '',
                name: project.tl_bank_name || '',
                branch: project.tl_bank_branch || '',
                holder: project.tl_account_holder || ''
            });
            setTpBank({
                account: project.tp_bank_account || '',
                name: project.tp_bank_name || '',
                branch: project.tp_bank_branch || '',
                holder: project.tp_account_holder || ''
            });
            setStBank({
                account: project.st_bank_account || '',
                name: project.st_bank_name || '',
                branch: project.st_bank_branch || '',
                holder: project.st_account_holder || ''
            });
            setBankLoaded(true);
        } else {
            fetchCompanySettings();
        }
    }, [project]);

    const addMilestone = () => {
        setPaymentSchedule([...paymentSchedule, {
            id: 'ms-' + Date.now(),
            name: `Thanh toán đợt ${paymentSchedule.length + 1}`,
            percentage: 0,
            amount: 0,
            condition: '',
            has_guarantee: false,
            due_days: 30,
            base_type: milestoneBase
        }]);
    };

    const removeMilestone = (id) => {
        setPaymentSchedule(paymentSchedule.filter(m => m.id !== id));
    };

    const updateMilestone = (id, field, value) => {
        setPaymentSchedule(prev => prev.map(m => {
            if (m.id !== id) return m;
            let updated = { ...m, [field]: value };
            
            // Auto-sync % and Amount
            if (field === 'percentage') {
                const baseValue = milestoneBase === 'post_vat' ? tl_postVat : totalValue;
                updated.amount = Math.round(baseValue * (Number(value) / 100));
            } else if (field === 'amount') {
                const baseValue = milestoneBase === 'post_vat' ? tl_postVat : totalValue;
                updated.percentage = baseValue > 0 ? Number(((Number(value) / baseValue) * 100).toFixed(2)) : 0;
            }
            return updated;
        }));
    };

    // Sync payment schedule amounts when totalValue changes
    useEffect(() => {
        const baseValue = milestoneBase === 'post_vat' ? tl_postVat : totalValue;
        setPaymentSchedule(prev => prev.map(ms => ({
            ...ms,
            amount: Math.round(baseValue * (Number(ms.percentage) / 100)),
            base_type: milestoneBase
        })));
    }, [totalValue, tl_postVat, milestoneBase]);

    const fetchPartners = async () => {
        setIsLoadingPartners(true);
        const { data } = await supabase.from('partners').select('*').eq('type', 'Client').order('name');
        setPartners(data || []);
        setIsLoadingPartners(false);
    };

    const fetchCompanySettings = async () => {
        const { data } = await supabase.from('company_settings').select('*');
        if (data) {
            setAllCompanies(data);
            const tl = data.find(d => d.company_key === 'thanglong');
            const st = data.find(d => d.company_key === 'sateco');
            const tp = data.find(d => d.company_key === 'thanhphat');
            
            // Defaulting bank info from DB if new
            if (!project) {
                if (tl) setTlBank({ account: tl.bank_account || '', name: tl.bank_name || '', branch: tl.bank_branch || '', holder: tl.account_holder || '' });
                if (st) setStBank({ account: st.bank_account || '', name: st.bank_name || '', branch: st.bank_branch || '', holder: st.account_holder || '' });
                if (tp) setTpBank({ account: tp.bank_account || '', name: tp.bank_name || '', branch: tp.bank_branch || '', holder: tp.account_holder || '' });
            }
            setBankLoaded(true);
        }
    };

    const fetchBankProfiles = async () => {
        const { data } = await supabase.from('company_bank_profiles').select('*').order('label');
        setBankProfiles(data || []);
    };

    const handleBankProfileSelect = (profileId) => {
        setSelectedBankProfile(profileId);
        if (!profileId) return;
        
        const profile = bankProfiles.find(p => p.id === profileId);
        if (profile) {
            setTlBank({
                account: profile.tl_account_number || '',
                name: profile.tl_bank_name || '',
                branch: profile.tl_branch || '',
                holder: profile.tl_holder || 'CÔNG TY TNHH THĂNG LONG'
            });
            setTpBank({
                account: profile.tp_account_number || '',
                name: profile.tp_bank_name || '',
                branch: profile.tp_branch || '',
                holder: profile.tp_holder || 'CÔNG TY TNHH THÀNH PHÁT'
            });
            setStBank({
                account: profile.st_account_number || '',
                name: profile.st_bank_name || '',
                branch: profile.st_branch || '',
                holder: profile.st_holder || 'CÔNG TY CP SATECO'
            });
            setEditingBank(false); // Close edit mode after auto-fill
        }
    };

    // ── Value Input Handler ──
    const handleValueChange = (e) => {
        const raw = e.target.value;
        setTotalValueDisplay(raw);
        const num = parseFormattedNumber(raw);
        setTotalValue(num);
        setPostVatDisplay(formatInputNumber(Math.round(num * (1 + vat / 100))));
    };

    const handlePostVatChange = (e) => {
        const raw = e.target.value;
        setPostVatDisplay(raw);
        const num = parseFormattedNumber(raw);
        const preVatNum = Math.round(num / (1 + vat / 100));
        setTotalValue(preVatNum);
        setTotalValueDisplay(formatInputNumber(preVatNum));
    };

    const handleValueBlur = () => {
        if (totalValue > 0) {
            setTotalValueDisplay(formatInputNumber(totalValue));
            setPostVatDisplay(formatInputNumber(Math.round(totalValue * (1 + vat / 100))));
        } else {
            setTotalValueDisplay('');
            setPostVatDisplay('');
        }
    };

    const handlePostVatBlur = () => {
        const num = parseFormattedNumber(postVatDisplay);
        if (num > 0) {
            setPostVatDisplay(formatInputNumber(num));
            setTotalValueDisplay(formatInputNumber(Math.round(num / (1 + vat / 100))));
        } else {
             setTotalValueDisplay('');
             setPostVatDisplay('');
        }
    };

    const handleValueFocus = (e) => {
        e.target.select();
    };

    const handlePostVatFocus = (e) => {
        e.target.select();
    };

    // ── Create Partner ──
    const handleCreatePartner = async (e) => {
        e.preventDefault();
        if (!partnerForm.name) return;
        setIsSaving(true);
        const typeMap = { 'Chủ đầu tư': 'Client', 'Tổng thầu': 'Client', 'Đối tác chiến lược': 'Client', 'Công ty con / Sateco': 'Client' };
        const { partner_type, ...rest } = partnerForm;
        const payload = { ...rest, type: typeMap[partner_type] || 'Client' };
        const { data, error } = await supabase.from('partners').insert([payload]).select();
        setIsSaving(false);
        if (error) {
            alert('Lỗi khi tạo đối tác: ' + (error.message || 'Lỗi không xác định'));
        } else if (data?.[0]) {
            setPartners(prev => [...prev, data[0]]);
            setPartnerId(data[0].id);
            setShowPartnerModal(false);
            setPartnerForm({...defaultPartnerForm});
        }
    };

    // ── Save ──
    const handleSave = async () => {
        if (!name || !code || !partnerId) {
            alert('Vui lòng điền đủ Tên hợp đồng, Mã và chọn Đối tác!');
            return;
        }
        setIsSaving(true);

        // Save company settings
        await supabase.from('company_settings').upsert([
            { company_key: 'thanglong', company_name: 'CÔNG TY TNHH THĂNG LONG', bank_account: tlBank.account, bank_name: tlBank.name, bank_branch: tlBank.branch, account_holder: tlBank.holder },
            { company_key: 'thanhphat', company_name: 'CÔNG TY TNHH THÀNH PHÁT', bank_account: tpBank.account, bank_name: tpBank.name, bank_branch: tpBank.branch, account_holder: tpBank.holder },
            { company_key: 'sateco', company_name: 'CÔNG TY CP SATECO', bank_account: stBank.account, bank_name: stBank.name, bank_branch: stBank.branch, account_holder: stBank.holder },
        ], { onConflict: 'company_key' });

        const selectedPartner = partners.find(p => p.id === partnerId);
        
        // Build full desired payload
        // Build full desired payload
        const fullPayload = {
            name, code, 
            internal_code: internalCode || null,
            partner_id: partnerId,
            client_id: partnerId,
            client: selectedPartner?.name || 'Unknown',
            contract_type: contractType,
            contract_form: contractForm,
            location, description,
            payment_terms: paymentTerms,
            original_value: totalValue,
            sateco_contract_ratio: contractRatio,
            internal_vat_percentage: internalVat,
            sateco_actual_ratio: actualRatio,
            internal_deduction: internalDeduction,
            warranty_percentage: warrantyRatio,
            warranty_ratio: warrantyRatio,
            warranty_duration_months: warrantyPeriod,
            warranty_period_months: warrantyPeriod,
            has_warranty_guarantee: hasWarrantyBond,
            has_warranty_bond: hasWarrantyBond,
            handover_date: handoverDate || null,
            warranty_schedule: warrantySchedule || [],
            payment_schedule: paymentSchedule.map(ms => ({ ...ms, base_type: milestoneBase })) || [],
            tl_bank_account: tlBank.account || null,
            tl_bank_name: tlBank.name || null,
            tl_bank_branch: tlBank.branch || null,
            tl_account_holder: tlBank.holder || null,
            tp_bank_account: tpBank.account || null,
            tp_bank_name: tpBank.name || null,
            tp_bank_branch: tpBank.branch || null,
            tp_account_holder: tpBank.holder || null,
            st_bank_account: stBank.account || null,
            st_bank_name: stBank.name || null,
            st_bank_branch: stBank.branch || null,
            st_account_holder: stBank.holder || null,
            sign_date: signDate || null,
            start_date: startDate || null,
            end_date: endDate || null,
            vat_percentage: vat,
            vat_amount: tl_vatAmount,
            total_value_post_vat: tl_postVat,
            status: project?.status || 'Đang thi công',
            acting_entity_key: (actingEntityKey || 'thanglong').toLowerCase().trim(),
            acting_entity_id: allCompanies.find(c => (c.company_key || '').toLowerCase() === (actingEntityKey || '').toLowerCase())?.id || null
        };

        let currentPayload = { ...fullPayload };
        let lastError = null;
        let finalSavedProject = null;
        let success = false;
        let attempts = 0;

        // Recursive retry loop to strip missing columns
        while (!success && attempts < 15) {
            attempts++;
            const { data, error: opError } = project?.id 
                ? await supabase.from('projects').update(currentPayload).eq('id', project.id).select().single()
                : await supabase.from('projects').insert([currentPayload]).select().single();

            if (!opError) {
                finalSavedProject = data;
                success = true;
                break;
            }

            // Check if error is "Column not found"
            if (opError.code === 'PGRST204' || (opError.message && (opError.message.includes('column') || opError.message.includes('not found')))) {
                // Look for any quoted string in the error message
                const matches = opError.message.match(/['"]([^'"]+)['"]/g);
                if (matches) {
                    let strippedAny = false;
                    for (const m of matches) {
                        const colName = m.replace(/['"]/g, '');
                        if (currentPayload[colName] !== undefined) {
                            console.warn(`Stripping missing column from payload: ${colName}`);
                            delete currentPayload[colName];
                            strippedAny = true;
                        }
                    }
                    if (strippedAny) continue; // Retry with stripped payload
                }
            }
            
            lastError = opError;
            break; // Stop for other types of errors
        }

        // Google Drive folder logic (also resilient)
        if (success && finalSavedProject && isDriveConnected && !googleDriveFolderId) {
            try {
                const folder = await drive.createProjectFolderStructure(name, internalCode || code);
                await supabase.from('projects').update({ 
                    google_drive_folder_id: folder.id,
                    document_link: folder.link 
                }).eq('id', finalSavedProject.id).then(res => {
                    if (res.error) console.warn('Drive column update skipped:', res.error.message);
                });
                setGoogleDriveFolderId(folder.id);
            } catch (driveErr) {
                console.error('Drive creation error:', driveErr);
            }
        }

        setIsSaving(false);
        if (!success) {
            console.error('Save failed after retries:', lastError);
            alert('Có lỗi khi lưu! ' + (lastError?.message || 'Lỗi không xác định'));
        } else {
            alert(project?.id ? 'Cập nhật Hợp đồng thành công!' : 'Tạo Hợp đồng thành công!');
            onBack();
        }
    };

    // navItems imported from contractHelpers

    return (
        <div className="bg-slate-50 text-slate-900 antialiased min-h-screen flex flex-col w-full absolute inset-0 z-50 overflow-hidden font-sans">
            {/* Header */}
            <header className="shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-20 sticky top-0">
                <div className="flex items-center gap-6">
                    <button onClick={onBack} className="flex items-center gap-3 text-slate-600 hover:text-indigo-600 transition-colors">
                        <span className="material-symbols-outlined notranslate text-2xl" translate="no">arrow_back</span>
                        <div className="flex flex-col text-left hidden sm:flex">
                            <span className="text-xs font-medium text-slate-500">Quay lại</span>
                            <h1 className="text-xl font-bold leading-none text-slate-800">
                                {project ? 'Chỉnh sửa Hợp đồng' : 'Thêm mới Hợp đồng'}
                            </h1>
                        </div>
                    </button>
                    <h1 className="text-xl font-bold leading-none text-slate-800 sm:hidden">
                        {project ? 'Sửa HĐ' : 'Hợp đồng mới'}
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="btn btn-glass text-slate-600 bg-white hover:bg-slate-50 border-slate-200">Hủy</button>
                    
                    {!isDriveConnected ? (
                        <button 
                            onClick={async () => {
                                try {
                                    await drive.requestAccessToken();
                                    setIsDriveConnected(true);
                                } catch (err) { alert('Lỗi kết nối Google: ' + (err.message || 'Hủy')); }
                            }}
                            className="btn bg-white border-blue-200 text-blue-600 hover:bg-blue-50 flex items-center gap-2 shadow-sm px-4"
                        >
                            <img src="https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png" className="w-5 h-5" alt="Drive" />
                            <span className="hidden sm:inline">Kết nối Drive</span>
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-[10px] font-black uppercase tracking-tight">
                            <span className="material-symbols-outlined notranslate text-[16px]" translate="no">check_circle</span>
                            <span className="hidden sm:inline">Đã kết nối Drive</span>
                        </div>
                    )}

                    <button disabled={isSaving} onClick={handleSave} className="btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50">
                        <span className="material-symbols-outlined notranslate text-sm" translate="no">check_circle</span>
                        {isSaving ? 'Đang lưu...' : 'Hoàn tất'}
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Nav */}
                <aside className="hidden lg:flex w-64 flex-col border-r border-slate-200/60 bg-white/40 backdrop-blur-sm py-8 overflow-y-auto">
                    <nav className="flex flex-col gap-2 px-4">
                        <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Mục lục hồ sơ</p>
                        {navItems.map((item) => (
                            <a key={item.id} href={`#${item.id}`} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm text-slate-600 transition-all font-medium text-sm group">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.bg} ${item.color} group-hover:scale-110 transition-transform`}>
                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">{item.icon}</span>
                                </div>
                                {item.label}
                            </a>
                        ))}
                    </nav>
                </aside>

                <main className="flex-1 overflow-y-auto p-4 lg:p-10 scroll-smooth pb-32">
                    <div className="max-w-4xl mx-auto space-y-8">

                        {/* ═══════ SECTION 1: Thông tin pháp lý ═══════ */}
                        <section id="general" className="glass-panel p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100 rounded-full blur-[80px] -z-10"></div>
                            <h2 className="text-lg font-bold mb-6 flex items-center gap-3 pb-4 border-b border-slate-100/50">
                                <span className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                                    <span className="material-symbols-outlined notranslate text-[22px]" translate="no">description</span>
                                </span>
                                1. Thông tin pháp lý Hợp đồng
                            </h2>

                            <div className="mb-8 p-5 bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-3xl shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/30 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-110 transition-transform duration-700"></div>
                                <label className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-4 block flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-[12px] shadow-sm">
                                        <span className="material-symbols-outlined text-[14px]">shield</span>
                                    </span>
                                    Pháp nhân ký kết (Nội bộ Sateco Group) *
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {companyEntities.map(company => (
                                        <button
                                            key={company.key}
                                            type="button"
                                            onClick={() => setActingEntityKey(company.key)}
                                            className={`relative flex flex-col items-start px-5 py-4 rounded-2xl border-2 transition-all duration-300 ${
                                                actingEntityKey === company.key 
                                                    ? `border-${company.color}-500 bg-${company.color}-50/50 shadow-md ring-4 ring-${company.color}-500/5` 
                                                    : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:shadow-sm'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between w-full mb-1">
                                                <span className={`text-[12px] font-black uppercase ${actingEntityKey === company.key ? `text-${company.color}-700` : 'text-slate-600'}`}>
                                                    {company.name}
                                                </span>
                                                {actingEntityKey === company.key && (
                                                    <span className={`material-symbols-outlined text-[20px] text-${company.color}-600 animate-in zoom-in duration-300`}>check_circle</span>
                                                )}
                                            </div>
                                            <span className="text-[10px] opacity-70 font-medium">{company.desc}</span>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-4 italic flex items-center gap-1.5 opacity-80">
                                    <span className="material-symbols-outlined text-[14px]">info</span>
                                    * Lựa chọn này sẽ thay đổi các chỉ số KPI và luồng ngân hàng thụ hưởng bên dưới.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className={labelBase}>Tên dự án / Hợp đồng *</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputBase} placeholder="VD: Gói thầu thi công PCCC KCN Intco..." />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined notranslate text-[14px]" translate="no">tag</span>
                                        Mã HĐ Nội bộ (Quản lý)
                                    </label>
                                    <input type="text" value={internalCode} onChange={e => setInternalCode(e.target.value)} className="w-full rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 text-sm font-bold text-blue-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" placeholder="VD: TL-2024-01 (tự đặt)" />
                                    <p className="text-[10px] text-slate-400 mt-1">Mã tự đặt để tìm kiếm nhanh trên hệ thống</p>
                                </div>
                                <div>
                                    <label className={labelBase}>Số / Mã hợp đồng *</label>
                                    <input type="text" value={code} onChange={e => setCode(e.target.value)} className={inputBase} placeholder="VD: 2024/INTCO-TL/HD-TC" />
                                    <p className="text-[10px] text-slate-400 mt-1">Số HĐ chính thức theo Chủ Đầu Tư</p>
                                </div>
                                <div>
                                    <label className={labelBase}>Loại hợp đồng</label>
                                    <select value={contractType} onChange={e => setContractType(e.target.value)} className={`${inputBase} appearance-none`}>
                                        <option>Thi công</option><option>Cung cấp vật tư</option><option>Tư vấn thiết kế</option><option>Bảo trì / Bảo dưỡng</option><option>Phát sinh / Phụ lục</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-purple-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined notranslate text-[14px]" translate="no">category</span>
                                        Hình thức hợp đồng
                                    </label>
                                    <select value={contractForm} onChange={e => setContractForm(e.target.value)} className="w-full rounded-xl border border-purple-200 bg-purple-50/40 p-3.5 text-sm font-bold text-purple-700 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm appearance-none">
                                        <option>Trọn gói</option><option>Theo khối lượng</option><option>Theo đơn giá</option><option>Hỗn hợp</option><option>EPC (Thiết kế - Mua sắm - Thi công)</option><option>BOT / PPP</option><option>Khác</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelBase}>Địa điểm triển khai</label>
                                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} className={inputBase} placeholder="VD: KCN Hữu Nghị, Lạng Sơn" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelBase}>Mô tả / Ghi chú</label>
                                    <textarea value={description} onChange={e => setDescription(e.target.value)} className={`${inputBase} h-24 resize-none`} placeholder="Thông tin tóm tắt nội dung gói thầu..." />
                                </div>
                            </div>
                        </section>

                        {/* ═══════ SECTION 2: Đối tác ═══════ */}
                        <section id="partner" className="glass-panel p-8 relative z-20">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-100 rounded-full blur-[80px] -z-10"></div>
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100/50">
                                <h2 className="text-lg font-bold flex items-center gap-3">
                                    <span className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shadow-sm">
                                        <span className="material-symbols-outlined notranslate text-[22px]" translate="no">corporate_fare</span>
                                    </span>
                                    2. Đối tác (Chủ đầu tư / Tổng thầu)
                                </h2>
                                <button onClick={() => setShowPartnerModal(true)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-orange-600 text-sm font-bold flex items-center gap-2 hover:bg-orange-50 hover:border-orange-200 transition-all shadow-sm">
                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">add</span>
                                    Pháp nhân mới
                                </button>
                            </div>
                            <div className="space-y-6">
                                <div className="relative">
                                    <label className={labelBase}>Chọn pháp nhân đối tác *</label>
                                    <SearchableSelect
                                        options={partners.map(p => ({ 
                                            id: p.id, 
                                            label: p.name, 
                                            subLabel: `${p.code ? `[${p.code}] ` : ''}${p.short_name ? `${p.short_name} ` : ''}${p.tax_code ? `• MST: ${p.tax_code}` : ''}`.trim() 
                                        }))}
                                        value={partnerId}
                                        onChange={(val) => setPartnerId(val)}
                                        placeholder="-- Tìm kiếm trong danh bạ hệ thống --"
                                        loading={isLoadingPartners}
                                    />
                                </div>
                                {partnerId && partners.find(p => p.id === partnerId) && (() => {
                                    const p = partners.find(p2 => p2.id === partnerId);
                                    return (
                                        <div className="bg-orange-50/50 rounded-xl p-5 border border-dashed border-orange-200 grid grid-cols-2 gap-5 animate-fade-in relative">
                                            <div className="absolute -left-[1px] top-4 bottom-4 w-[3px] bg-orange-400 rounded-r-md"></div>
                                            <div><p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Mã số thuế</p><p className="font-bold text-slate-700">{p.tax_code || '—'}</p></div>
                                            <div><p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Đại diện</p><p className="font-bold text-slate-700">{p.representative || '—'}</p></div>
                                            <div className="col-span-2"><p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Địa chỉ</p><p className="font-medium text-slate-600 line-clamp-2">{p.address || '—'}</p></div>
                                        </div>
                                    );
                                })()}

                            </div>
                        </section>

                        {/* ═══════ SECTION 3: Giá trị & Thời gian ═══════ */}
                        <section id="value" className="glass-panel p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-green-100 rounded-full blur-[80px] -z-10"></div>
                            <h2 className="text-lg font-bold mb-6 flex items-center gap-3 pb-4 border-b border-slate-100/50">
                                <span className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 text-green-600 flex items-center justify-center shadow-sm">
                                    <span className="material-symbols-outlined notranslate text-[22px]" translate="no">payments</span>
                                </span>
                                3. Giá trị Hợp đồng Thăng Long & Thời gian
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-1 border-r border-slate-200/60 pr-4">
                                    <label className={labelBase}>Giá trị Trước VAT (VNĐ)</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={totalValueDisplay}
                                            onChange={handleValueChange}
                                            onBlur={handleValueBlur}
                                            onFocus={handleValueFocus}
                                            className="w-full rounded-xl border border-slate-200 bg-white/80 p-3.5 pr-12 text-lg font-black text-green-600 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all shadow-sm"
                                            placeholder="48.400.000.000"
                                            inputMode="numeric"
                                        />
                                        <span className="absolute right-4 top-[14px] text-green-400 font-bold pointer-events-none">₫</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 font-medium">Bằng chữ: <span className="text-slate-600">{formatBillion(totalValue)}</span></p>
                                </div>
                                <div className="border-r border-slate-200/60 pr-4">
                                    <label className={labelBase}>Giá trị CÓ VAT (VNĐ)</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={postVatDisplay}
                                            onChange={handlePostVatChange}
                                            onBlur={handlePostVatBlur}
                                            onFocus={handlePostVatFocus}
                                            className="w-full rounded-xl border border-green-100 bg-green-50/50 p-3.5 pr-12 text-lg font-black text-slate-800 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all shadow-inner"
                                            placeholder="52.272.000.000"
                                            inputMode="numeric"
                                        />
                                        <span className="absolute right-4 top-[14px] text-green-500 font-bold pointer-events-none">₫</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 font-medium">Bằng chữ: <span className="text-slate-600">{formatBillion(Math.round(totalValue * (1 + vat / 100)))}</span></p>
                                </div>
                                <div>
                                    <label className={labelBase}>Thuế VAT (%)</label>
                                    <div className="relative">
                                        <input type="number" value={vat} onChange={e => {
                                            const newVat = Number(e.target.value);
                                            setVat(newVat);
                                            setPostVatDisplay(formatInputNumber(Math.round(totalValue * (1 + newVat / 100))));
                                        }} className="w-full rounded-xl border border-slate-200 bg-white/80 p-3.5 pr-10 text-sm font-bold focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all shadow-sm" />
                                        <span className="absolute right-4 top-[14px] text-slate-400 pointer-events-none">%</span>
                                    </div>
                                </div>

                                <div className="col-span-full h-px bg-slate-100 my-2"></div>

                                <div>
                                    <label className={labelBase}>Ngày ký HĐ</label>
                                    <input type="date" value={signDate} onChange={e => setSignDate(e.target.value)} className={`${inputBase} px-4`} />
                                </div>
                                <div>
                                    <label className={labelBase}>Ngày bắt đầu</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${inputBase} px-4`} />
                                </div>
                                <div>
                                    <label className={labelBase}>Hạn hoàn thành</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`${inputBase} px-4`} />
                                </div>
                            </div>
                        </section>

                        {/* ═══════ SECTION 4: Lộ trình Thanh toán & Điều khoản ═══════ */}
                        <section id="milestone" className="glass-panel p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-100 rounded-full blur-[80px] -z-10"></div>
                            <h2 className="text-lg font-bold mb-6 flex items-center justify-between pb-4 border-b border-slate-100/50">
                                <div className="flex items-center gap-3">
                                    <span className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shadow-sm">
                                        <span className="material-symbols-outlined notranslate text-[22px]" translate="no">route</span>
                                    </span>
                                    4. Lộ trình Thanh toán & Điều khoản (Milestones)
                                </div>
                            </h2>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <div className="mt-2 flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 inline-flex">
                                                <button 
                                                    type="button"
                                                    onClick={() => setMilestoneBase('pre_vat')}
                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${milestoneBase === 'pre_vat' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                                >
                                                    Tính theo Trước VAT
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => setMilestoneBase('post_vat')}
                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${milestoneBase === 'post_vat' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                                >
                                                    Tính theo Sau VAT
                                                </button>
                                            </div>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={addMilestone}
                                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-black flex items-center gap-1.5 hover:bg-blue-100 transition-all border border-blue-100 self-start mt-1"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                            THÊM ĐỢT
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {paymentSchedule.map((ms, index) => (
                                            <div key={ms.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 group hover:border-blue-300 transition-all relative">
                                                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-blue-500 opacity-20 group-hover:opacity-100 transition-opacity"></div>

                                                {/* Single compact row: # Name | % | Amount | Days | Guarantee | Delete */}
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-black border border-blue-100 shrink-0">{index + 1}</span>
                                                    <input 
                                                        type="text" value={ms.name} 
                                                        onChange={e => updateMilestone(ms.id, 'name', e.target.value)}
                                                        className="w-[130px] bg-transparent border-none p-0 text-sm font-black text-slate-800 focus:ring-0 outline-none placeholder:text-slate-300 shrink-0"
                                                        placeholder="Tên đợt..."
                                                    />
                                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                        {/* % */}
                                                        <div className="relative w-[82px] shrink-0">
                                                            <input type="number" step="0.1" value={ms.percentage} 
                                                                onChange={e => updateMilestone(ms.id, 'percentage', e.target.value)}
                                                                className="w-full pl-2 pr-7 py-1.5 bg-blue-50/60 border border-blue-200 rounded-lg text-sm font-black text-blue-700 outline-none focus:border-blue-500"
                                                                placeholder="0"
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-blue-400">%</span>
                                                        </div>
                                                        <span className="text-slate-300 text-xs">=</span>
                                                        {/* Amount */}
                                                        <div className="relative flex-1 min-w-[100px]">
                                                            <input type="text" value={formatInputNumber(ms.amount)} 
                                                                onChange={e => updateMilestone(ms.id, 'amount', parseFormattedNumber(e.target.value))}
                                                                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                                                                placeholder="Số tiền..."
                                                            />
                                                            <span className="absolute -bottom-3.5 right-0 text-[9px] font-bold text-blue-500">≈ {formatBillion(ms.amount)}</span>
                                                        </div>
                                                        {/* Due Days */}
                                                        <div className="relative w-[100px] shrink-0">
                                                            <input type="number" value={ms.due_days || ''} 
                                                                onChange={e => updateMilestone(ms.id, 'due_days', Number(e.target.value) || 0)}
                                                                className="w-full pl-3 pr-11 py-1.5 bg-amber-50/60 border border-amber-200 rounded-lg text-sm font-bold text-amber-700 outline-none focus:border-amber-500"
                                                                placeholder="30"
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-amber-400">ngày</span>
                                                        </div>
                                                        {/* Guarantee */}
                                                        <button type="button"
                                                            onClick={() => updateMilestone(ms.id, 'has_guarantee', !ms.has_guarantee)}
                                                            className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all flex items-center gap-1 shrink-0 ${ms.has_guarantee ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-400 border border-slate-200 opacity-50 hover:opacity-100'}`}
                                                        >
                                                            <span className="material-symbols-outlined text-[12px]">{ms.has_guarantee ? 'verified' : 'shield'}</span>
                                                            Bảo lãnh
                                                        </button>
                                                        {/* Delete */}
                                                        <button type="button" onClick={() => removeMilestone(ms.id)}
                                                            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Row 2: Condition (compact) */}
                                                <div className="flex items-center gap-2 mt-1.5 pl-8">
                                                    <input type="text" value={ms.condition}
                                                        onChange={e => updateMilestone(ms.id, 'condition', e.target.value)}
                                                        className="flex-1 px-2 py-1 bg-slate-50/50 border border-slate-100 rounded-lg text-[11px] text-slate-500 outline-none focus:border-blue-400 placeholder:text-slate-300"
                                                        placeholder="Điều kiện: Sau khi ký HĐ, Nghiệm thu 80%..."
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Traditional Terms Note */}
                                    <div className="mt-6 pt-4 border-t border-slate-100">
                                        <label className={labelBase}>Ghi chú Điều khoản đặc thù khác (Văn bản)</label>
                                        <textarea 
                                            value={paymentTerms} 
                                            onChange={e => setPaymentTerms(e.target.value)} 
                                            className={`${inputBase} h-20 resize-none bg-slate-50/50 border-dashed`} 
                                            placeholder="Ghi thêm các cam kết, điều kiện ràng buộc pháp lý khác nếu có..." 
                                        />
                                    </div>
                                </div>
                        </section>

                        {/* ═══════ SECTION 5: Phân bổ nội bộ Sateco ═══════ */}
                        <section id="sateco" className="glass-panel p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100 rounded-full blur-[80px] -z-10"></div>
                            <h2 className="text-lg font-bold mb-6 flex items-center gap-3 pb-4 border-b border-slate-100/50">
                                <span className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
                                    <span className="material-symbols-outlined notranslate text-[22px]" translate="no">hub</span>
                                </span>
                                5. Phân bổ Chỉ ngân Sateco (Nội bộ)
                            </h2>

                            {/* Ratio Controls */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                {/* Internal VAT */}
                                <div className="glass-card bg-emerald-50/30 border-emerald-100 p-5">
                                    <label className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                                        <span>Thuế VAT Nội bộ (%)</span>
                                        <span className="text-emerald-600 text-base font-black">{internalVat}%</span>
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input type="number" step="1" min="0" max="100" value={internalVat} onChange={e => setInternalVat(Number(e.target.value))} className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm text-center font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2">VAT xuất hóa đơn Sateco (mặc định 8%)</p>
                                </div>

                                {/* Contract Ratio */}
                                <div className="glass-card bg-indigo-50/30 border-indigo-100 p-5">
                                    <label className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                                        <span>Tỷ lệ khoán trên HĐ (Xuất hóa đơn)</span>
                                        <span className="text-indigo-600 text-base font-black">{contractRatio}%</span>
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input type="range" min="0" max="100" step="0.5" value={contractRatio} onChange={e => { setContractRatio(Number(e.target.value)); if (internalDeduction > Number(e.target.value)) setInternalDeduction(0); }} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                        <input type="number" step="0.5" value={contractRatio} onChange={e => setContractRatio(Number(e.target.value))} className="w-16 rounded-md border border-slate-200 bg-white p-1 text-xs text-center font-bold text-indigo-700 outline-none" />
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2">TL cắt <span className="font-bold text-red-500">{tl_cutPercent}%</span> = <span className="font-bold">{fmt(tl_cutAmount)} ₫</span></p>
                                </div>

                                {/* Internal Deduction */}
                                <div className="glass-card bg-purple-50/30 border-purple-100 p-5">
                                    <label className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                                        <span>Chiết khấu dòng nội bộ thêm</span>
                                        <span className="text-purple-600 text-base font-black">{internalDeduction}%</span>
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input type="range" min="0" max={contractRatio} step="0.5" value={internalDeduction} onChange={e => setInternalDeduction(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600" />
                                        <input type="number" step="0.5" min="0" max={contractRatio} value={internalDeduction} onChange={e => setInternalDeduction(Math.min(Number(e.target.value), contractRatio))} className="w-16 rounded-md border border-slate-200 bg-white p-1 text-xs text-center font-bold text-purple-700 outline-none" />
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2">
                                        {internalDeduction > 0
                                            ? <>TL cắt thêm nội bộ <span className="font-bold text-purple-600">{internalDeduction}%</span> = <span className="font-bold">{fmt(internalCutAmount)} ₫</span></>
                                            : 'Không chiết khấu thêm — Sateco hưởng đủ tỷ lệ khoán'
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Summary Table */}
                            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                            <th className="text-left p-4"></th>
                                            <th className="text-right p-4">Trước VAT</th>
                                            <th className="text-right p-4">VAT ({vat}%)</th>
                                            <th className="text-right p-4">Sau VAT</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {/* TL Row */}
                                        <tr className="bg-blue-50/30">
                                            <td className="p-4 font-bold text-blue-700 flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                Thăng Long (100%)
                                            </td>
                                            <td className="p-4 text-right font-bold text-slate-800">{fmt(tl_preVat)}</td>
                                            <td className="p-4 text-right text-slate-600">{fmt(tl_vatAmount)}</td>
                                            <td className="p-4 text-right font-black text-blue-700">{fmt(tl_postVat)}</td>
                                        </tr>
                                        {/* Sateco Invoice Row */}
                                        <tr className="bg-indigo-50/30">
                                            <td className="p-4 font-bold text-indigo-700 flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                Sateco - Hóa đơn ({contractRatio}%)
                                            </td>
                                            <td className="p-4 text-right font-bold text-slate-800">{fmt(st_invoice_preVat)}</td>
                                            <td className="p-4 text-right text-slate-600">{fmt(st_invoice_vat)}</td>
                                            <td className="p-4 text-right font-black text-indigo-700">{fmt(st_invoice_postVat)}</td>
                                        </tr>
                                        {/* Sateco Actual Row */}
                                        {internalDeduction > 0 && (
                                            <tr className="bg-purple-50/30">
                                                <td className="p-4 font-bold text-purple-700 flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                                    Sateco - Thực nhận ({actualRatio}%)
                                                </td>
                                                <td className="p-4 text-right font-black text-purple-700">{fmt(st_actual_preVat)}</td>
                                                <td className="p-4 text-right text-slate-600">{fmt(st_actual_vat)}</td>
                                                <td className="p-4 text-right font-black text-purple-700">{fmt(st_actual_postVat)}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Warning */}
                            {internalDeduction > 0 && (
                                <div className="mt-4 bg-purple-100/50 rounded-xl p-4 border border-purple-200 flex gap-3">
                                    <span className="material-symbols-outlined notranslate text-[20px] text-purple-500 mt-0.5" translate="no">account_balance_wallet</span>
                                    <div className="text-[11px] text-purple-800 leading-relaxed">
                                        <p>Sateco xuất hóa đơn <span className="font-bold">{contractRatio}%</span> ({fmt(st_invoice_preVat)} ₫ trước VAT) nhưng thực nhận chỉ <span className="font-bold">{actualRatio}%</span> ({fmt(st_actual_preVat)} ₫).</p>
                                        <p className="mt-1">→ Chênh lệch nội bộ: <span className="font-black underline">{fmt(internalCutAmount)} ₫</span> ({internalDeduction}%)</p>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* ═══════ SECTION 6: Bảo hành ═══════ */}
                        <section id="warranty" className="glass-panel p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full blur-[80px] -z-10"></div>
                            <h2 className="text-lg font-black mb-10 flex items-center gap-4 pb-4 border-b border-slate-100/50">
                                <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 to-white border border-amber-100 text-amber-600 flex items-center justify-center shadow-sm relative group overflow-hidden">
                                     <div className="absolute inset-0 bg-amber-100/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                                     <span className="material-symbols-outlined notranslate text-[26px] relative z-10" translate="no">verified_user</span>
                                </span>
                                <div>
                                    <span className="block text-[10px] font-black text-amber-600/60 uppercase tracking-[0.2em] mb-0.5">Vận hành & Hậu mãi</span>
                                    6. Bảo hành Dự án
                                </div>
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                                <div>
                                    <label className={labelBase}>Ngày bàn giao thực tế</label>
                                    <input type="date" value={handoverDate} onChange={e => setHandoverDate(e.target.value)} className={`${inputBase} border-blue-200 bg-blue-50/20`} />
                                    <p className="text-[10px] text-slate-400 mt-1 italic">Mốc để tính ngày thu bảo hành</p>
                                </div>
                                <div>
                                    <label className={labelBase}>Tỷ lệ bảo hành (%)</label>
                                    <div className="relative">
                                        <input type="number" step="0.5" value={warrantyRatio} onChange={e => setWarrantyRatio(Number(e.target.value))} className={`${inputBase} pr-10`} />
                                        <span className="absolute right-4 top-[14px] text-slate-400 pointer-events-none">%</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1">Giá trị: <span className="font-bold text-amber-600">{fmt(warrantyAmount)} ₫</span></p>
                                </div>
                                <div>
                                    <label className={labelBase}>Thời gian bảo hành</label>
                                    <div className="relative">
                                        <input type="number" value={warrantyPeriod} onChange={e => setWarrantyPeriod(Number(e.target.value))} className={`${inputBase} pr-16`} />
                                        <span className="absolute right-4 top-[14px] text-slate-400 pointer-events-none text-xs">tháng</span>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelBase}>Bảo lãnh bảo hành</label>
                                    <div
                                        onClick={() => setHasWarrantyBond(!hasWarrantyBond)}
                                        className={`w-full rounded-xl border p-3.5 text-sm font-bold cursor-pointer transition-all shadow-sm flex items-center gap-3 h-[48px] ${hasWarrantyBond ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white/80 border-slate-200 text-slate-500'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${hasWarrantyBond ? 'bg-green-500 border-green-500' : 'border-slate-300'}`}>
                                            {hasWarrantyBond && <span className="material-symbols-outlined notranslate text-white text-[14px]" translate="no">check</span>}
                                        </div>
                                        {hasWarrantyBond ? 'Có bảo lãnh' : 'Không có bảo lãnh'}
                                    </div>
                                </div>
                            </div>

                            {/* Special Schedule Splits: Premium UI */}
                            <div className="bg-slate-50/80 rounded-3xl border border-slate-200/60 p-8 shadow-inner relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full blur-3xl -z-10"></div>
                                
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-700 flex items-center gap-2 uppercase tracking-tight">
                                            <span className="material-symbols-outlined notranslate text-[20px] text-amber-500" translate="no">splitscreen</span>
                                            Chia đợt thu hồi bảo hành
                                        </h3>
                                        <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Dùng cho các hợp đồng có kỳ hạn thu tiền phức tạp (VD: Chia theo năm)</p>
                                    </div>
                                    <button 
                                        onClick={() => setWarrantySchedule([...warrantySchedule, { label: `Đợt ${warrantySchedule.length + 1}`, ratio: 0, months: 12 }])}
                                        className="btn bg-white hover:bg-slate-50 text-blue-600 border-blue-200 shadow-sm px-4 py-2 rounded-xl group"
                                    >
                                        <span className="material-symbols-outlined notranslate text-[18px] group-hover:rotate-90 transition-transform" translate="no">add_circle</span>
                                        Thêm đợt thu tiền
                                    </button>
                                </div>

                                {warrantySchedule.length === 0 ? (
                                    <div className="text-center py-4 bg-white/40 rounded-xl border border-slate-100">
                                        <p className="text-xs text-slate-400 italic">Mặc định thu toàn bộ ({warrantyRatio}%) sau {warrantyPeriod} tháng.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {warrantySchedule.map((stage, idx) => (
                                            <div key={idx} className="flex flex-wrap items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-slide-in relative group/row">
                                                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-full opacity-0 group-hover/row:opacity-100 transition-opacity"></div>
                                                
                                                <div className="flex-1 min-w-[180px]">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tên đợt thu tiền</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined notranslate text-slate-300 text-[18px]" translate="no">label</span>
                                                        <input type="text" value={stage.label} onChange={e => {
                                                            const newS = [...warrantySchedule];
                                                            newS[idx].label = e.target.value;
                                                            setWarrantySchedule(newS);
                                                        }} className="w-full text-xs font-bold bg-slate-50 border-none pl-10 pr-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-100 transition-all" />
                                                    </div>
                                                </div>
                                                
                                                <div className="w-32">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tỷ lệ (%)</label>
                                                    <div className="relative">
                                                        <input type="number" step="0.5" value={stage.ratio} onChange={e => {
                                                            const newS = [...warrantySchedule];
                                                            newS[idx].ratio = Number(e.target.value);
                                                            setWarrantySchedule(newS);
                                                        }} className="w-full text-xs font-black bg-blue-50/30 border border-blue-100/50 px-4 py-2.5 rounded-xl text-blue-700 focus:ring-2 focus:ring-blue-100 transition-all" />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-400">%</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="w-32">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Kỳ hạn (Tháng)</label>
                                                    <div className="relative">
                                                        <input type="number" value={stage.months} onChange={e => {
                                                            const newS = [...warrantySchedule];
                                                            newS[idx].months = Number(e.target.value);
                                                            setWarrantySchedule(newS);
                                                        }} className="w-full text-xs font-black bg-slate-50 border-none px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-100 transition-all" />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">tháng</span>
                                                    </div>
                                                </div>

                                                <div className="hidden lg:block h-10 w-px bg-slate-100"></div>

                                                <div className="min-w-[120px]">
                                                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Số tiền dự kiến</p>
                                                    <p className="text-xs font-black text-slate-600">{fmt(totalValue * (stage.ratio / 100))} ₫</p>
                                                </div>
                                                <button 
                                                    onClick={() => setWarrantySchedule(warrantySchedule.filter((_, i) => i !== idx))}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:bg-rose-50 hover:text-rose-600 mt-4 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined notranslate text-[18px]" translate="no">delete</span>
                                                </button>
                                            </div>
                                        ))}
                                        <div className="flex justify-end pr-4">
                                            <p className={`text-[10px] font-bold ${Math.abs(warrantySchedule.reduce((s, a) => s + Number(a.ratio), 0) - warrantyRatio) < 0.01 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                Tổng cộng: {warrantySchedule.reduce((s, a) => s + Number(a.ratio), 0)}% / {warrantyRatio}%
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* ═══════ SECTION 7: Ngân hàng thụ hưởng ═══════ */}
                        <section id="banking" className="glass-panel p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-100 rounded-full blur-[80px] -z-10"></div>
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100/50">
                                <h2 className="text-lg font-bold flex items-center gap-3">
                                    <span className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shadow-sm">
                                        <span className="material-symbols-outlined notranslate text-[22px]" translate="no">account_balance_wallet</span>
                                    </span>
                                    7. Tài khoản Ngân hàng Thụ hưởng
                                </h2>
                                <div className="flex items-center gap-4">
                                     <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Chọn nhanh:</span>
                                         <select 
                                            value={selectedBankProfile} 
                                            onChange={(e) => handleBankProfileSelect(e.target.value)}
                                            className="text-xs font-bold bg-transparent border-none focus:ring-0 text-teal-700 p-0"
                                         >
                                             <option value="">-- Chọn Ngân hàng --</option>
                                             {bankProfiles.map(p => (
                                                 <option key={p.id} value={p.id}>{p.label}</option>
                                             ))}
                                         </select>
                                     </div>

                                    <button onClick={() => setEditingBank(!editingBank)} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm border ${editingBank ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-teal-600 border-slate-200 hover:bg-teal-50 hover:border-teal-200'}`}>
                                        <span className="material-symbols-outlined notranslate text-[16px]" translate="no">{editingBank ? 'check' : 'edit'}</span>
                                        {editingBank ? 'Xong' : 'Chỉnh sửa'}
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 mb-6 -mt-2">Sử dụng dropdown "Chọn nhanh" để tự động điền thông tin cho cả 2 phía.</p>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Primary Entity Bank (TL/TP/ST) */}
                                {(() => {
                                    const entityInfo = {
                                        thanglong: { name: 'Thăng Long', color: 'blue', state: tlBank, set: setTlBank },
                                        thanhphat: { name: 'Thành Phát', color: 'amber', state: tpBank, set: setTpBank },
                                        sateco: { name: 'Sateco', color: 'emerald', state: stBank, set: setStBank }
                                    };
                                    const current = entityInfo[actingEntityKey] || entityInfo.thanglong;
                                    
                                    return (
                                        <div className={`glass-card bg-${current.color}-50/30 border-${current.color}-100 p-6 relative overflow-hidden transition-all duration-500`}>
                                            <div className={`absolute top-0 left-0 w-1 h-full bg-${current.color}-500`}></div>
                                            <h3 className={`text-sm font-black text-${current.color}-800 mb-4 flex items-center gap-2 uppercase tracking-tight`}>
                                                <span className="material-symbols-outlined notranslate text-[18px]" translate="no">account_balance</span>
                                                {current.name} — Nhận từ CĐT
                                            </h3>
                                            {editingBank ? (
                                                <div className="space-y-4 animate-fade-in">
                                                    <div><label className={labelBase}>Số tài khoản</label><input type="text" value={current.state.account} onChange={e => current.set({...current.state, account: e.target.value})} className={inputBase} placeholder="Số tài khoản..." /></div>
                                                    <div><label className={labelBase}>Ngân hàng</label><input type="text" value={current.state.name} onChange={e => current.set({...current.state, name: e.target.value})} className={inputBase} placeholder="Tên ngân hàng..." /></div>
                                                    <div><label className={labelBase}>Chi nhánh</label><input type="text" value={current.state.branch} onChange={e => current.set({...current.state, branch: e.target.value})} className={inputBase} placeholder="Chi nhánh..." /></div>
                                                    <div><label className={labelBase}>Chủ tài khoản</label><input type="text" value={current.state.holder} onChange={e => current.set({...current.state, holder: e.target.value})} className={inputBase} placeholder="Tên công ty đứng tên..." /></div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {[{l: 'Số TK', v: current.state.account}, {l: 'Ngân hàng', v: current.state.name}, {l: 'Chi nhánh', v: current.state.branch}, {l: 'Chủ TK', v: current.state.holder}].map((item, i) => (
                                                        <div key={i} className="flex justify-between items-center text-sm border-b border-slate-100/50 pb-2 last:border-0">
                                                            <span className="text-slate-500 text-xs">{item.l}</span>
                                                            <span className={`font-bold ${item.v ? 'text-slate-800' : 'text-slate-300 italic'}`}>{item.v || 'Chưa cài đặt'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Secondary Entity Bank (Sateco) */}
                                {actingEntityKey !== 'sateco' && (
                                    <div className="glass-card bg-emerald-50/30 border-emerald-100 p-6 relative overflow-hidden transition-all duration-500 animate-in slide-in-from-right">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                                        <h3 className="text-sm font-black text-emerald-800 mb-4 flex items-center gap-2 uppercase tracking-tight">
                                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">sync_alt</span>
                                            Sateco — Nhận từ {actingEntityKey === 'thanglong' ? 'Thăng Long' : 'Thành Phát'}
                                        </h3>
                                        {editingBank ? (
                                            <div className="space-y-4 animate-fade-in">
                                                <div><label className={labelBase}>Số tài khoản</label><input type="text" value={stBank.account} onChange={e => setStBank({...stBank, account: e.target.value})} className={inputBase} placeholder="Số tài khoản Sateco..." /></div>
                                                <div><label className={labelBase}>Ngân hàng</label><input type="text" value={stBank.name} onChange={e => setStBank({...stBank, name: e.target.value})} className={inputBase} placeholder="Ngân hàng Sateco..." /></div>
                                                <div><label className={labelBase}>Chi nhánh</label><input type="text" value={stBank.branch} onChange={e => setStBank({...stBank, branch: e.target.value})} className={inputBase} placeholder="Chi nhánh Sateco..." /></div>
                                                <div><label className={labelBase}>Chủ tài khoản</label><input type="text" value={stBank.holder} onChange={e => setStBank({...stBank, holder: e.target.value})} className={inputBase} placeholder="CÔNG TY CP SATECO" /></div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {[{l: 'Số TK', v: stBank.account}, {l: 'Ngân hàng', v: stBank.name}, {l: 'Chi nhánh', v: stBank.branch}, {l: 'Chủ TK', v: stBank.holder}].map((item, i) => (
                                                    <div key={i} className="flex justify-between items-center text-sm border-b border-slate-100/50 pb-2 last:border-0">
                                                        <span className="text-slate-500 text-xs">{item.l}</span>
                                                        <span className={`font-bold ${item.v ? 'text-slate-800' : 'text-slate-300 italic'}`}>{item.v || 'Chưa cài đặt'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>

                    </div>
                </main>
            </div>

            {/* ═══════ MODAL: New Partner ═══════ */}
            {showPartnerModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="glass-panel bg-white w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up border-none">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                                    <span className="material-symbols-outlined notranslate" translate="no">person_add</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Thêm Pháp nhân Đối tác Mới</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Thông tin dùng cho hợp đồng, hóa đơn và giao dịch ngân hàng</p>
                                </div>
                            </div>
                            <button onClick={() => setShowPartnerModal(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-500 hover:text-slate-800">
                                <span className="material-symbols-outlined notranslate" translate="no">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleCreatePartner} className="p-8 overflow-y-auto space-y-8 bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className={labelBase}>Tên pháp nhân (Đầy đủ) *</label>
                                    <input type="text" required value={partnerForm.name} onChange={e => setPartnerForm({ ...partnerForm, name: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" placeholder="VD: CÔNG TY TNHH ABC VIỆT NAM" />
                                </div>
                                <div>
                                    <label className={labelBase}>Mã số thuế</label>
                                    <input type="text" value={partnerForm.tax_code} onChange={e => setPartnerForm({ ...partnerForm, tax_code: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" placeholder="VD: 0123456789" />
                                </div>
                                <div>
                                    <label className={labelBase}>Loại đối tác</label>
                                    <select value={partnerForm.partner_type} onChange={e => setPartnerForm({ ...partnerForm, partner_type: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none appearance-none transition-all">
                                        <option>Chủ đầu tư</option><option>Tổng thầu</option><option>Đối tác chiến lược</option><option>Công ty con / Sateco</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelBase}>Địa chỉ đăng ký kinh doanh</label>
                                    <input type="text" value={partnerForm.address} onChange={e => setPartnerForm({ ...partnerForm, address: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" placeholder="Địa chỉ ghi trên Hợp đồng/Hóa đơn" />
                                </div>
                            </div>
                            <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className={labelBase}>Người đại diện pháp luật</label>
                                    <input type="text" value={partnerForm.representative} onChange={e => setPartnerForm({ ...partnerForm, representative: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" placeholder="VD: Ông Nguyễn Văn A" />
                                </div>
                                <div>
                                    <label className={labelBase}>Chức vụ đại diện</label>
                                    <input type="text" value={partnerForm.representative_title} onChange={e => setPartnerForm({ ...partnerForm, representative_title: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" placeholder="VD: Tổng Giám Đốc" />
                                </div>
                                <div>
                                    <label className={labelBase}>Số tài khoản ngân hàng</label>
                                    <input type="text" value={partnerForm.bank_account} onChange={e => setPartnerForm({ ...partnerForm, bank_account: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" placeholder="VD: 1903xxx..." />
                                </div>
                                <div>
                                    <label className={labelBase}>Ngân hàng (Tên & CN)</label>
                                    <input type="text" value={partnerForm.bank_name} onChange={e => setPartnerForm({ ...partnerForm, bank_name: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" placeholder="VD: Techcombank - CN Hà Thành" />
                                </div>
                            </div>
                            <div className="pt-6 mt-4 border-t border-slate-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowPartnerModal(false)} className="btn btn-glass bg-white text-slate-600 hover:bg-slate-50 border-slate-200">Hủy bỏ</button>
                                <button type="submit" disabled={isSaving} className="btn bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md shadow-orange-500/20">Lưu & Chọn đối tác</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import * as drive from '../lib/googleDrive';
import { logAudit } from '../lib/auditLog';
import { useNotification } from '../context/NotificationContext';
import { useToast } from '../context/ToastContext';
import {
    formatInputNumber, parseFormattedNumber, navItems, defaultPartnerForm,
    calculateAllocations
} from './contract/contractHelpers';

// Sub-components
import ContractLegalInfo from './contract/ContractLegalInfo';
import ContractPartner from './contract/ContractPartner';
import ContractPartnerModal from './contract/ContractPartnerModal';
import ContractValueTime from './contract/ContractValueTime';
import ContractMilestones from './contract/ContractMilestones';
import ContractSateco from './contract/ContractSateco';
import ContractWarranty from './contract/ContractWarranty';
import ContractBanking from './contract/ContractBanking';

export default function ContractCreate({ onBack, project }) {
    const { sendNotification } = useNotification();
    const toast = useToast();
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
    const [signatureStatus, setSignatureStatus] = useState('Chưa ký');
    const [settlementStatus, setSettlementStatus] = useState('Chưa quyết toán');
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
    const [bankProfiles, setBankProfiles] = useState([]);
    const [selectedBankProfile, setSelectedBankProfile] = useState('');

    // ── Partners ──
    const [partners, setPartners] = useState([]);
    const [isLoadingPartners, setIsLoadingPartners] = useState(false);
    const [showPartnerModal, setShowPartnerModal] = useState(false);
    const [partnerForm, setPartnerForm] = useState({...defaultPartnerForm});

    const [isSaving, setIsSaving] = useState(false);
    const [milestoneBase, setMilestoneBase] = useState('pre_vat');

    // ── CALCULATIONS ──
    const alloc = calculateAllocations(totalValue, vat, internalVat, contractRatio, internalDeduction);
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
            setSignatureStatus(project.signature_status || 'Chưa ký');
            setSettlementStatus(project.settlement_status || 'Chưa quyết toán');
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
            
            setTlBank({ account: project.tl_bank_account || '', name: project.tl_bank_name || '', branch: project.tl_bank_branch || '', holder: project.tl_account_holder || '' });
            setTpBank({ account: project.tp_bank_account || '', name: project.tp_bank_name || '', branch: project.tp_bank_branch || '', holder: project.tp_account_holder || '' });
            setStBank({ account: project.st_bank_account || '', name: project.st_bank_name || '', branch: project.st_bank_branch || '', holder: project.st_account_holder || '' });
        } else {
            fetchCompanySettings();
        }
    }, [project, fetchCompanySettings, fetchPartners, fetchBankProfiles]);

    function addMilestone() {
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

    useEffect(() => {
        const baseValue = milestoneBase === 'post_vat' ? tl_postVat : totalValue;
        setPaymentSchedule(prev => prev.map(ms => ({
            ...ms,
            amount: Math.round(baseValue * (Number(ms.percentage) / 100)),
            base_type: milestoneBase
        })));
    }, [totalValue, tl_postVat, milestoneBase]);

    const fetchPartners = React.useCallback(async () => {
        setIsLoadingPartners(true);
        const { data } = await supabase.from('partners').select('*').eq('type', 'Client').order('name');
        setPartners(data || []);
        setIsLoadingPartners(false);
    }, []);

    const fetchCompanySettings = React.useCallback(async () => {
        const { data } = await supabase.from('company_settings').select('*');
        if (data) {
            setAllCompanies(data);
            const tl = data.find(d => d.company_key === 'thanglong');
            const st = data.find(d => d.company_key === 'sateco');
            const tp = data.find(d => d.company_key === 'thanhphat');
            
            if (!project) {
                if (tl) setTlBank({ account: tl.bank_account || '', name: tl.bank_name || '', branch: tl.bank_branch || '', holder: tl.account_holder || '' });
                if (st) setStBank({ account: st.bank_account || '', name: st.bank_name || '', branch: st.bank_branch || '', holder: st.account_holder || '' });
                if (tp) setTpBank({ account: tp.bank_account || '', name: tp.bank_name || '', branch: tp.bank_branch || '', holder: tp.account_holder || '' });
            }
        }
    }, [project]);

    const fetchBankProfiles = React.useCallback(async () => {
        const { data } = await supabase.from('company_bank_profiles').select('*').order('label');
        setBankProfiles(data || []);
    }, []);

    const handleBankProfileSelect = (profileId) => {
        setSelectedBankProfile(profileId);
        if (!profileId) return;
        
        const profile = bankProfiles.find(p => p.id === profileId);
        if (profile) {
            setTlBank({
                account: profile.tl_account_number || '', name: profile.tl_bank_name || '',
                branch: profile.tl_branch || '', holder: profile.tl_holder || 'CÔNG TY TNHH THĂNG LONG'
            });
            setTpBank({
                account: profile.tp_account_number || '', name: profile.tp_bank_name || '',
                branch: profile.tp_branch || '', holder: profile.tp_holder || 'CÔNG TY TNHH THÀNH PHÁT'
            });
            setStBank({
                account: profile.st_account_number || '', name: profile.st_bank_name || '',
                branch: profile.st_branch || '', holder: profile.st_holder || 'CÔNG TY CP SATECO'
            });
            setEditingBank(false);
        }
    };

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

    function handleValueBlur() {
        if (totalValue > 0) {
            setTotalValueDisplay(formatInputNumber(totalValue));
            setPostVatDisplay(formatInputNumber(Math.round(totalValue * (1 + vat / 100))));
        } else {
            setTotalValueDisplay('');
            setPostVatDisplay('');
        }
    };

    function handlePostVatBlur() {
        const num = parseFormattedNumber(postVatDisplay);
        if (num > 0) {
            setPostVatDisplay(formatInputNumber(num));
            setTotalValueDisplay(formatInputNumber(Math.round(num / (1 + vat / 100))));
        } else {
             setTotalValueDisplay('');
             setPostVatDisplay('');
        }
    };

    const handleValueFocus = (e) => { e.target.select(); };
    const handlePostVatFocus = (e) => { e.target.select(); };

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
            toast.error('Lỗi khi tạo đối tác: ' + (error.message || 'Lỗi không xác định'));
        } else if (data?.[0]) {
            setPartners(prev => [...prev, data[0]]);
            setPartnerId(data[0].id);
            setShowPartnerModal(false);
            setPartnerForm({...defaultPartnerForm});
            toast.success('Tạo đối tác thành công!');
        }
    };

    async function handleSave() {
        if (!name || !code || !partnerId) {
            toast.warning('Vui lòng điền đủ Tên hợp đồng, Mã và chọn Đối tác!');
            return;
        }
        setIsSaving(true);

        await supabase.from('company_settings').upsert([
            { company_key: 'thanglong', company_name: 'CÔNG TY TNHH THĂNG LONG', bank_account: tlBank.account, bank_name: tlBank.name, bank_branch: tlBank.branch, account_holder: tlBank.holder },
            { company_key: 'thanhphat', company_name: 'CÔNG TY TNHH THÀNH PHÁT', bank_account: tpBank.account, bank_name: tpBank.name, bank_branch: tpBank.branch, account_holder: tpBank.holder },
            { company_key: 'sateco', company_name: 'CÔNG TY CP SATECO', bank_account: stBank.account, bank_name: stBank.name, bank_branch: stBank.branch, account_holder: stBank.holder },
        ], { onConflict: 'company_key' });

        const selectedPartner = partners.find(p => p.id === partnerId);
        
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
            signature_status: signatureStatus,
            settlement_status: settlementStatus,
            acting_entity_key: (actingEntityKey || 'thanglong').toLowerCase().trim(),
            acting_entity_id: allCompanies.find(c => (c.company_key || '').toLowerCase() === (actingEntityKey || '').toLowerCase())?.id || null
        };

        let finalSavedProject = null;
        let success = false;

        const { data, error: opError } = project?.id 
            ? await supabase.from('projects').update(fullPayload).eq('id', project.id).select().single()
            : await supabase.from('projects').insert([fullPayload]).select().single();

        if (!opError) {
            finalSavedProject = data;
            success = true;
        } else {
            console.error('[ContractCreate] Lỗi lưu hợp đồng:', opError);
            console.error('[ContractCreate] Payload gửi đi:', fullPayload);
        }

        if (success && finalSavedProject && isDriveConnected && !googleDriveFolderId) {
            try {
                const folder = await drive.createProjectFolderStructure(name, internalCode || code);
                await supabase.from('projects').update({ 
                    google_drive_folder_id: folder.id,
                    document_link: folder.link 
                }).eq('id', finalSavedProject.id);
                setGoogleDriveFolderId(folder.id);
            } catch (driveErr) { console.error('Drive creation error:', driveErr); }
        }

        setIsSaving(false);
        if (!success) {
            toast.error('Có lỗi khi lưu hợp đồng! ' + (opError?.message || 'Lỗi không xác định'));
        } else {
            logAudit({
                action: project?.id ? 'UPDATE' : 'CREATE',
                tableName: 'projects',
                recordId: finalSavedProject?.id,
                recordName: name,
                changes: project?.id ? { original_value: { old: project.original_value, new: totalValue }, status: { old: project.status, new: 'Đang thi công' } } : null,
                metadata: { code, contract_type: contractType }
            });

            // Notification: Contract created or updated
            if (!project?.id) {
                sendNotification(
                    'view_contracts',
                    'Hợp đồng mới được tạo',
                    `Hợp đồng "${name}" (${code}) trị giá ${Number(totalValue || 0).toLocaleString('vi-VN')}đ vừa được thêm vào hệ thống.`,
                    'INFO',
                    '#contracts'
                );
            } else {
                sendNotification(
                    'manage_users',
                    'Hợp đồng được cập nhật',
                    `Hợp đồng "${name}" (${code}) vừa được chỉnh sửa giá trị/thông tin.`,
                    'WARNING',
                    '#contracts'
                );
            }

            toast.success(project?.id ? 'Cập nhật Hợp đồng thành công!' : 'Tạo Hợp đồng thành công!');
            onBack();
        }
    };

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
                                } catch (err) { toast.error('Lỗi kết nối Google: ' + (err.message || 'Hủy')); }
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
                        <ContractLegalInfo
                            name={name} setName={setName}
                            code={code} setCode={setCode}
                            internalCode={internalCode} setInternalCode={setInternalCode}
                            contractType={contractType} setContractType={setContractType}
                            contractForm={contractForm} setContractForm={setContractForm}
                            location={location} setLocation={setLocation}
                            description={description} setDescription={setDescription}
                            actingEntityKey={actingEntityKey} setActingEntityKey={setActingEntityKey}
                            signatureStatus={signatureStatus} setSignatureStatus={setSignatureStatus}
                            settlementStatus={settlementStatus} setSettlementStatus={setSettlementStatus}
                        />

                        <ContractPartner
                            partners={partners}
                            partnerId={partnerId} setPartnerId={setPartnerId}
                            isLoadingPartners={isLoadingPartners}
                            setShowPartnerModal={setShowPartnerModal}
                        />

                        <ContractValueTime
                            totalValueDisplay={totalValueDisplay} handleValueChange={handleValueChange} handleValueBlur={handleValueBlur} handleValueFocus={handleValueFocus} totalValue={totalValue}
                            postVatDisplay={postVatDisplay} handlePostVatChange={handlePostVatChange} handlePostVatBlur={handlePostVatBlur} handlePostVatFocus={handlePostVatFocus} vat={vat} setVat={setVat} setPostVatDisplay={setPostVatDisplay}
                            signDate={signDate} setSignDate={setSignDate}
                            startDate={startDate} setStartDate={setStartDate}
                            endDate={endDate} setEndDate={setEndDate}
                            formatInputNumber={formatInputNumber}
                        />

                        <ContractMilestones
                            paymentSchedule={paymentSchedule} setPaymentSchedule={setPaymentSchedule}
                            milestoneBase={milestoneBase} setMilestoneBase={setMilestoneBase}
                            totalValue={totalValue} tl_postVat={tl_postVat}
                            addMilestone={addMilestone} removeMilestone={removeMilestone} updateMilestone={updateMilestone}
                            paymentTerms={paymentTerms} setPaymentTerms={setPaymentTerms}
                        />

                        <ContractSateco
                            internalVat={internalVat} setInternalVat={setInternalVat}
                            contractRatio={contractRatio} setContractRatio={setContractRatio}
                            internalDeduction={internalDeduction} setInternalDeduction={setInternalDeduction}
                            vat={vat}
                            tl_cutPercent={tl_cutPercent} tl_cutAmount={tl_cutAmount} internalCutAmount={internalCutAmount}
                            tl_preVat={tl_preVat} tl_vatAmount={tl_vatAmount} tl_postVat={tl_postVat}
                            st_invoice_preVat={st_invoice_preVat} st_invoice_vat={st_invoice_vat} st_invoice_postVat={st_invoice_postVat}
                            st_actual_preVat={st_actual_preVat} st_actual_vat={st_actual_vat} st_actual_postVat={st_actual_postVat}
                            actualRatio={actualRatio}
                        />

                        <ContractWarranty
                            handoverDate={handoverDate} setHandoverDate={setHandoverDate}
                            warrantyRatio={warrantyRatio} setWarrantyRatio={setWarrantyRatio}
                            warrantyPeriod={warrantyPeriod} setWarrantyPeriod={setWarrantyPeriod}
                            hasWarrantyBond={hasWarrantyBond} setHasWarrantyBond={setHasWarrantyBond}
                            warrantySchedule={warrantySchedule} setWarrantySchedule={setWarrantySchedule}
                            warrantyAmount={warrantyAmount} totalValue={totalValue}
                        />

                        <ContractBanking
                            bankProfiles={bankProfiles} selectedBankProfile={selectedBankProfile} handleBankProfileSelect={handleBankProfileSelect}
                            editingBank={editingBank} setEditingBank={setEditingBank}
                            actingEntityKey={actingEntityKey}
                            tlBank={tlBank} setTlBank={setTlBank}
                            tpBank={tpBank} setTpBank={setTpBank}
                            stBank={stBank} setStBank={setStBank}
                        />
                    </div>
                </main>
            </div>

            <ContractPartnerModal
                showPartnerModal={showPartnerModal} setShowPartnerModal={setShowPartnerModal}
                partnerForm={partnerForm} setPartnerForm={setPartnerForm}
                handleCreatePartner={handleCreatePartner} isSaving={isSaving}
            />
        </div>
    );
}

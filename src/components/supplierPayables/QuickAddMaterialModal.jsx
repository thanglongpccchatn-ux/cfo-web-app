import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import NumberInput from '../common/NumberInput';
import SearchableSelect from '../common/SearchableSelect';

const acc = (s) => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
const slug = (s) => acc(s).toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6) || 'VT';
const hash5 = (s) => { let h = 0; for (const c of acc(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(36).toUpperCase().slice(0, 5).padStart(5, '0'); };

const EMPTY = {
    code: '', name: '', category_code: '', brand: '', model: '', unit: 'cái',
    base_price: 0, import_unit: '', import_conversion_rate: 1,
    export_unit: '', export_conversion_rate: 1, weight_per_unit: '', notes: '',
};

const inputCls = "w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none";

// Field tách ra ngoài component để KHÔNG bị tạo lại mỗi render (tránh mất focus khi gõ)
const Field = ({ label, children }) => (
    <div>
        <label className="block text-[11px] font-bold text-slate-500 mb-1">{label}</label>
        {children}
    </div>
);

/**
 * Thêm nhanh vật tư mới (đầy đủ trường) ngay trong luồng nhập đơn mua hàng.
 * Lưu vào bảng materials rồi trả về bản ghi đã tạo (onCreated) để chọn vào dòng.
 */
export default function QuickAddMaterialModal({ initialName = '', categories = [], onClose, onCreated }) {
    // Mount mỗi lần mở (parent render có điều kiện) → khởi tạo lazy theo tên gõ vào
    const [f, setF] = useState(() => ({ ...EMPTY, name: initialName }));
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const set = (k, v) => setF(p => ({ ...p, [k]: v }));
    const catLabel = categories.find(c => c.id === f.category_code)?.label || 'VT';
    const suggestedCode = `${slug(catLabel)}-${hash5(f.name || 'x')}`;

    const save = async () => {
        if (!f.name.trim()) { setErr('Vui lòng nhập Tên vật tư'); return; }
        const code = f.code.trim() || suggestedCode;
        setSaving(true); setErr('');
        const payload = {
            code, name: f.name.trim(),
            category_code: f.category_code || null,
            brand: f.brand || null, model: f.model || null, unit: f.unit || 'cái',
            base_price: Number(f.base_price) || 0, discount_percentage: 0, min_inventory: 0,
            weight_per_unit: f.weight_per_unit !== '' ? Number(f.weight_per_unit) : null,
            import_unit: f.import_unit || null, import_conversion_rate: Number(f.import_conversion_rate) || 1,
            export_unit: f.export_unit || null, export_conversion_rate: Number(f.export_conversion_rate) || 1,
            notes: f.notes || null,
        };
        const { data, error } = await supabase.from('materials').insert([payload]).select().single();
        setSaving(false);
        if (error) { setErr(error.code === '23505' ? `Mã "${code}" đã tồn tại — đổi mã khác` : error.message); return; }
        onCreated?.(data);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-[95vw] max-w-[640px] border border-slate-200 dark:border-slate-700 overflow-hidden"
                onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(); } }}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-slate-800">
                    <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-600 text-[20px]">add_box</span>
                        Thêm vật tư mới vào danh mục
                    </h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700">
                        <span className="material-symbols-outlined text-[20px] text-slate-500">close</span>
                    </button>
                </div>

                <div className="p-6 grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
                    <div className="col-span-2">
                        <Field label="TÊN VẬT TƯ *">
                            <input className={inputCls} value={f.name} onChange={e => set('name', e.target.value)} autoFocus />
                        </Field>
                    </div>
                    <Field label="MÃ VT (để trống = tự sinh)">
                        <input className={inputCls + ' font-mono'} value={f.code} placeholder={suggestedCode} onChange={e => set('code', e.target.value)} />
                    </Field>
                    <Field label="NHÓM / DANH MỤC">
                        <SearchableSelect value={f.category_code} onChange={id => set('category_code', id)}
                            placeholder="Gõ tìm nhóm..." options={categories} />
                    </Field>
                    <Field label="ĐVT (cơ sở)">
                        <input className={inputCls} value={f.unit} onChange={e => set('unit', e.target.value)} />
                    </Field>
                    <Field label="GIÁ VỐN">
                        <NumberInput className={inputCls + ' text-right font-mono tabular-nums'} value={f.base_price} onChange={v => set('base_price', v)} />
                    </Field>
                    <Field label="HÃNG">
                        <input className={inputCls} value={f.brand} onChange={e => set('brand', e.target.value)} />
                    </Field>
                    <Field label="MODEL">
                        <input className={inputCls} value={f.model} onChange={e => set('model', e.target.value)} />
                    </Field>
                    <Field label="ĐVT NHẬP (mua theo)">
                        <input className={inputCls} value={f.import_unit} placeholder="VD: hộp" onChange={e => set('import_unit', e.target.value)} />
                    </Field>
                    <Field label="1 ĐVT nhập = ? ĐVT cơ sở">
                        <input type="number" className={inputCls + ' text-right font-mono tabular-nums'} value={f.import_conversion_rate} onChange={e => set('import_conversion_rate', e.target.value)} />
                    </Field>
                    <Field label="ĐVT XUẤT (xuất theo)">
                        <input className={inputCls} value={f.export_unit} placeholder="VD: cái" onChange={e => set('export_unit', e.target.value)} />
                    </Field>
                    <Field label="Hệ số quy đổi xuất">
                        <input type="number" className={inputCls + ' text-right font-mono tabular-nums'} value={f.export_conversion_rate} onChange={e => set('export_conversion_rate', e.target.value)} />
                    </Field>
                    <Field label="TRỌNG LƯỢNG (kg/ĐVT)">
                        <input type="number" className={inputCls + ' text-right font-mono tabular-nums'} value={f.weight_per_unit} onChange={e => set('weight_per_unit', e.target.value)} />
                    </Field>
                    <div className="col-span-2">
                        <Field label="GHI CHÚ">
                            <input className={inputCls} value={f.notes} onChange={e => set('notes', e.target.value)} />
                        </Field>
                    </div>
                    {err && <div className="col-span-2 text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-lg px-3 py-2">{err}</div>}
                </div>

                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-end gap-3">
                    <kbd className="hidden md:inline text-[10px] font-mono text-slate-400 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5">Ctrl+Enter</kbd>
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Hủy</button>
                    <button onClick={save} disabled={saving || !f.name.trim()}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">{saving ? 'progress_activity' : 'save'}</span>
                        {saving ? 'Đang lưu...' : 'Lưu & chọn'}
                    </button>
                </div>
            </div>
        </div>
    );
}

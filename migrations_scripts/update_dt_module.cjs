const fs = require('fs');
const path = 'e:\\AG\\cfo-web-app\\src\\components\\DocumentTrackingModule.jsx';
let content = fs.readFileSync(path, 'utf8');

const target = `) : paymentHistory.length === 0 ? (
                                                               <div className="py-8 text-center bg-slate-100/30 rounded-xl border border-dashed border-slate-200">
                                                                   <p className="text-[11px] text-slate-500 font-bold">Chưa có bản ghi thanh toán nào</p>
                                                               </div>
                                                           ) : (`;

const replacement = `) : paymentHistory.length === 0 ? (
                                                               <div className="py-10 text-center bg-slate-50/50 rounded-[24px] border border-dashed border-slate-200 flex flex-col items-center justify-center gap-4">
                                                                   <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300">
                                                                       <span className="material-symbols-outlined notranslate text-3xl" translate="no">history</span>
                                                                   </div>
                                                                   <div className="max-w-xs">
                                                                       <p className="text-[11px] text-slate-500 font-black uppercase tracking-wider mb-1">Chưa có bản ghi lịch sử</p>
                                                                       <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">Hồ sơ này có thể đã được nhập số tổng từ trước mà chưa có chi tiết các lần thu.</p>
                                                                   </div>
                                                                   
                                                                   {Number(item.external_income || 0) > 0 && (
                                                                       <button 
                                                                           onClick={(e) => { e.stopPropagation(); generateHistory(item); }}
                                                                           className="mt-2 px-6 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl text-[10px] font-black transition-all border border-emerald-100 flex items-center gap-2 group"
                                                                       >
                                                                           <span className="material-symbols-outlined notranslate text-[16px]" translate="no">auto_fix</span>
                                                                           TẠO NHANH BẢN GHI LỊCH SỬ ({fmt(item.external_income)} ₫)
                                                                       </button>
                                                                   )}
                                                               </div>
                                                           ) : (`;

// Try to find the target even if whitespace is slightly different
const escapedTarget = target.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s+');
const regex = new RegExp(escapedTarget);

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully updated the file.');
} else {
    console.error('Could not find the target string in the file.');
    // List surrounding content to debug
    const index = content.indexOf('paymentHistory.length === 0');
    if (index !== -1) {
        console.log('Surrounding content:', content.substring(index - 50, index + 200));
    }
}

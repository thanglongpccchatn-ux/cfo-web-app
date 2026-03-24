import React from 'react';

export default function DeleteConfirmModal({ showDeleteConfirm, setShowDeleteConfirm, itemToDelete, handleDelete }) {
    if (!showDeleteConfirm) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}></div>
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
                <div className="p-8 text-center">
                    <div className="w-20 h-20 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 mx-auto mb-6 shadow-sm border border-rose-100">
                        <span className="material-symbols-outlined notranslate text-4xl" translate="no">delete_forever</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">Xác nhận xóa?</h3>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                        Bạn có chắc chắn muốn xóa hồ sơ <span className="text-rose-600 font-black">{itemToDelete?.stage_name}</span> của dự án <span className="font-bold text-slate-700">{itemToDelete?.projects?.internal_code || itemToDelete?.projects?.code}</span>? Hành động này không thể hoàn tác.
                    </p>
                </div>
                <div className="bg-slate-50 p-6 flex gap-3 border-t border-slate-100">
                    <button 
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-3 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-xl border border-slate-200 transition-all active:scale-95"
                    >
                        Hủy bỏ
                    </button>
                    <button 
                        onClick={handleDelete}
                        className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl shadow-lg shadow-rose-100 transition-all active:scale-95"
                    >
                        Xóa ngay
                    </button>
                </div>
            </div>
        </div>
    );
}

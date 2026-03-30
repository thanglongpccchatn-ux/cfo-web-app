import React from 'react';
import DriveFileUploader from '../common/DriveFileUploader';

export default function ContractDriveTab({ project, subfolders, selectedSubfolder, onSelectSubfolder, onOpenFullscreen }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4">
                <div className="glass-panel p-6 shadow-sm border border-slate-200/60 h-full">
                    <h3 className="font-bold text-sm mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                        <span className="material-symbols-outlined notranslate text-emerald-500 text-[20px]" translate="no">folder_shared</span>Cấu trúc thư mục
                    </h3>
                    
                    {!project.google_drive_folder_id ? (
                        <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                            <span className="material-symbols-outlined notranslate text-slate-300 text-4xl mb-3" translate="no">link_off</span>
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Chưa kết nối Drive</p>
                            <p className="text-[11px] text-slate-400 mt-2 px-6">Hãy cập nhật thông tin dự án để khởi tạo thư mục Drive tự động.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {subfolders.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => onSelectSubfolder(f)}
                                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all border ${
                                        selectedSubfolder?.id === f.id
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm'
                                            : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200'
                                    }`}
                                >
                                    <span className={`material-symbols-outlined notranslate text-[20px] ${selectedSubfolder?.id === f.id ? 'filled' : ''}`}>
                                        {selectedSubfolder?.id === f.id ? 'folder_open' : 'folder'}
                                    </span>
                                    <span className="text-sm font-bold truncate">{f.name}</span>
                                    {selectedSubfolder?.id === f.id && (
                                        <span className="material-symbols-outlined notranslate text-[16px] ml-auto animate-pulse" translate="no">chevron_right</span>
                                    )}
                                </button>
                            ))}
                            
                            <div className="mt-8 pt-6 border-t border-slate-100">
                                <a 
                                    href={`https://drive.google.com/drive/folders/${project.google_drive_folder_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                                >
                                    <img src="https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png" className="w-4 h-4" alt="Drive" />
                                    Mở toàn bộ trên Drive
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="lg:col-span-8">
                <div className="glass-panel p-8 shadow-sm border border-slate-200/60 bg-white/40 min-h-[400px] flex flex-col items-center justify-center">
                    {!project.google_drive_folder_id ? (
                        <div className="text-center max-w-sm">
                            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="material-symbols-outlined notranslate text-emerald-400 text-4xl" translate="no">add_to_drive</span>
                            </div>
                            <h3 className="text-lg font-black text-slate-800 mb-2">Khởi tạo không gian lưu trữ</h3>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">Bạn cần khởi tạo cấu trúc thư mục dự án trên Google Drive trước khi có thể tải tài liệu lên.</p>
                            <button 
                                onClick={() => onOpenFullscreen('contract_form', project)}
                                className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all uppercase text-xs tracking-widest"
                            >
                                Chỉnh sửa & Kết nối Drive
                            </button>
                        </div>
                    ) : selectedSubfolder ? (
                        <div className="w-full h-full flex flex-col">
                            <div className="mb-8 flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-200/50">
                                    <span className="material-symbols-outlined notranslate text-[28px]" translate="no">upload_file</span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Tải tài liệu lên</h3>
                                    <p className="text-sm font-medium text-slate-500">
                                        Tài liệu sẽ được đưa vào thư mục <span className="text-emerald-600 font-bold">"{selectedSubfolder.name}"</span>
                                    </p>
                                </div>
                            </div>
                            
                            <DriveFileUploader 
                                parentId={selectedSubfolder.id} 
                                folderName={selectedSubfolder.name}
                                onUploadSuccess={() => {}}
                            />
                            
                            <div className="mt-12 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Hướng dẫn</h4>
                                </div>
                                <ul className="space-y-3">
                                    {[
                                        'Chọn thư mục đích bên tay trái (Hợp đồng, Bản vẽ...).',
                                        'Kéo thả file hoặc nhấn vào vùng tải lên để chọn tài liệu.',
                                        'Hỗ trợ tất cả định dạng file (PDF, Excel, Ảnh, Bản vẽ...).',
                                        'File sau khi tải lên sẽ khả dụng ngay lập tức cho tất cả nhân sự có quyền truy cập.'
                                    ].map((text, i) => (
                                        <li key={i} className="flex gap-3 text-sm font-medium text-slate-600">
                                            <span className="text-emerald-500 font-black">{i + 1}.</span>
                                            {text}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center">
                            <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-sm font-bold text-slate-500">Đang tải cấu trúc thư mục...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

import React, { useState, useRef } from 'react';
import * as drive from '../../lib/googleDrive';
import { smartToast } from '../../utils/globalToast';

export default function DriveFileUploader({ parentId, folderName, onUploadSuccess }) {
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    const handleFiles = async (files) => {
        if (!files || files.length === 0) return;
        
        setIsUploading(true);
        setProgress(0);
        
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                // Simulate progress for smoother UI (since fetch multipart doesn't give real progress easily)
                const interval = setInterval(() => {
                    setProgress(prev => Math.min(prev + 10, 90));
                }, 200);
                
                await drive.uploadFile(file, parentId);
                
                clearInterval(interval);
                setProgress(100);
            }
            
            if (onUploadSuccess) onUploadSuccess();
            setTimeout(() => {
                setIsUploading(false);
                setProgress(0);
            }, 1000);
        } catch (err) {
            console.error('Upload error:', err);
            smartToast('Lỗi khi tải lên: ' + err.message);
            setIsUploading(false);
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFiles(e.target.files);
        }
    };

    return (
        <div className="w-full">
            <div 
                className={`relative border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center justify-center text-center ${
                    dragActive 
                        ? 'border-blue-500 bg-blue-50/50' 
                        : isUploading 
                            ? 'border-slate-200 bg-slate-50' 
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleChange}
                    disabled={isUploading}
                />

                {isUploading ? (
                    <div className="w-full max-w-xs transition-all animate-fade-in">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Đang tải lên...</span>
                            <span className="text-xs font-black text-blue-600">{progress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                            <div 
                                className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center group animate-fade-in">
                        <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                            <span className="material-symbols-outlined notranslate text-3xl text-blue-500" translate="no">cloud_upload</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-700 mb-1">
                            Tải tài liệu lên thư mục <span className="text-blue-600 font-black">"{folderName}"</span>
                        </h4>
                        <p className="text-xs text-slate-400 mb-6 font-medium">Kéo thả file vào đây hoặc nhấn để chọn</p>
                        
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 uppercase tracking-widest hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm"
                        >
                            Chọn Tập Tin
                        </button>
                    </div>
                )}
            </div>
            
            <div className="mt-4 flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <span className="material-symbols-outlined notranslate text-amber-500 text-[18px]" translate="no">info</span>
                <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                    Tài liệu sẽ được lưu trữ an toàn trên Google Drive trong thư mục dự án tương ứng.
                </p>
            </div>
        </div>
    );
}

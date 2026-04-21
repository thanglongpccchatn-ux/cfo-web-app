/**
 * ✏️ MessageInput — Chat Input with File Attachment
 * 
 * Auto-resizing textarea with file/image attachment buttons,
 * drag & drop support, and file preview before sending.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { formatFileSize } from '../../lib/chatStorage';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export default function MessageInput({
    onSend,
    onSendFile,
    onTyping,
    isSending,
}) {
    const [text, setText] = useState('');
    const [pendingFiles, setPendingFiles] = useState([]); // [{file, previewUrl}]
    const [isDragOver, setIsDragOver] = useState(false);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Auto-resize textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
        }
    }, [text]);

    // Handle text change + typing indicator
    const handleTextChange = (e) => {
        setText(e.target.value);

        // Debounce typing indicator
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        onTyping?.();
        typingTimeoutRef.current = setTimeout(() => {
            // Typing stopped
        }, 2000);
    };

    // Handle send
    const handleSend = useCallback(() => {
        // Send pending files first
        if (pendingFiles.length > 0) {
            pendingFiles.forEach(({ file }) => {
                onSendFile?.(file);
            });
            setPendingFiles([]);
        }

        // Send text
        if (text.trim()) {
            onSend?.(text.trim());
            setText('');
            textareaRef.current?.focus();
        }
    }, [text, pendingFiles, onSend, onSendFile]);

    // Handle key press (Enter to send, Shift+Enter for new line)
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Handle file selection
    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        addFiles(files);
        // Reset input so same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Add files to pending list
    const addFiles = (files) => {
        const validFiles = files.filter(f => {
            if (f.size > MAX_FILE_SIZE) {
                alert(`File "${f.name}" quá lớn. Giới hạn 25MB.`);
                return false;
            }
            return true;
        });

        const newPending = validFiles.map(file => ({
            file,
            previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        }));

        setPendingFiles(prev => [...prev, ...newPending]);
    };

    // Remove pending file
    const removePendingFile = (index) => {
        setPendingFiles(prev => {
            const file = prev[index];
            if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
            return prev.filter((_, i) => i !== index);
        });
    };

    // Drag & drop handlers
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length > 0) addFiles(files);
    };

    // Handle paste (for images)
    const handlePaste = (e) => {
        const items = Array.from(e.clipboardData?.items || []);
        const imageItems = items.filter(item => item.type.startsWith('image/'));
        
        if (imageItems.length > 0) {
            e.preventDefault();
            const files = imageItems.map(item => item.getAsFile()).filter(Boolean);
            addFiles(files);
        }
    };

    const hasContent = text.trim() || pendingFiles.length > 0;

    return (
        <div
            className={`border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 transition-colors ${
                isDragOver ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300' : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag overlay */}
            {isDragOver && (
                <div className="px-4 py-3 text-center animate-fade-in">
                    <div className="border-2 border-dashed border-blue-400 rounded-xl py-6">
                        <span className="material-symbols-outlined text-3xl text-blue-400 mb-2">cloud_upload</span>
                        <p className="text-sm font-medium text-blue-500">Thả file vào đây để gửi</p>
                    </div>
                </div>
            )}

            {/* Pending files preview */}
            {pendingFiles.length > 0 && (
                <div className="px-4 pt-3 flex gap-2 flex-wrap">
                    {pendingFiles.map((pf, i) => (
                        <div key={i} className="relative group">
                            {pf.previewUrl ? (
                                <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                    <img src={pf.previewUrl} alt="" className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div className="w-20 h-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center gap-1 px-1">
                                    <span className="material-symbols-outlined text-[20px] text-slate-400">attach_file</span>
                                    <span className="text-[9px] text-slate-400 truncate w-full text-center">{pf.file.name}</span>
                                    <span className="text-[8px] text-slate-300">{formatFileSize(pf.file.size)}</span>
                                </div>
                            )}
                            <button
                                onClick={() => removePendingFile(i)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[12px]">close</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input row */}
            <div className="flex items-end gap-2 px-4 py-3">
                {/* Attachment button */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-500 transition-all cursor-pointer flex-shrink-0"
                    title="Đính kèm file"
                    aria-label="Đính kèm file"
                >
                    <span className="material-symbols-outlined text-[22px]">attach_file</span>
                </button>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.dwg"
                />

                {/* Image button */}
                <button
                    onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.multiple = true;
                        input.onchange = (e) => {
                            const files = Array.from(e.target.files || []);
                            addFiles(files);
                        };
                        input.click();
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-green-500 transition-all cursor-pointer flex-shrink-0"
                    title="Gửi hình ảnh"
                    aria-label="Gửi hình ảnh"
                >
                    <span className="material-symbols-outlined text-[22px]">image</span>
                </button>

                {/* Text input */}
                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={handleTextChange}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder="Nhập tin nhắn..."
                        rows={1}
                        className="w-full resize-none rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-transparent focus:border-blue-400 dark:focus:border-blue-500 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none transition-all leading-relaxed"
                        style={{ maxHeight: '150px' }}
                        disabled={isSending}
                    />
                </div>

                {/* Send button */}
                <button
                    onClick={handleSend}
                    disabled={!hasContent || isSending}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all flex-shrink-0 cursor-pointer ${
                        hasContent && !isSending
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 hover:-translate-y-0.5'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    }`}
                    title="Gửi tin nhắn"
                    aria-label="Gửi tin nhắn"
                >
                    {isSending ? (
                        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                        <span className="material-symbols-outlined text-[20px]">send</span>
                    )}
                </button>
            </div>
        </div>
    );
}

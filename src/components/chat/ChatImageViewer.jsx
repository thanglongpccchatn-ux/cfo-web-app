/**
 * 🖼️ ChatImageViewer — Fullscreen Image Lightbox
 * 
 * View images in fullscreen with navigation between images,
 * zoom controls, and download button.
 */

import React, { useState, useCallback, useEffect } from 'react';

export default function ChatImageViewer({ imageUrl, images = [], onClose }) {
    const [currentIndex, setCurrentIndex] = useState(() => {
        const idx = images.indexOf(imageUrl);
        return idx >= 0 ? idx : 0;
    });
    const [isZoomed, setIsZoomed] = useState(false);

    const currentImage = images[currentIndex] || imageUrl;
    const hasMultiple = images.length > 1;

    // Navigate to previous image
    const goToPrev = useCallback(() => {
        setCurrentIndex(prev => prev > 0 ? prev - 1 : images.length - 1);
        setIsZoomed(false);
    }, [images.length]);

    // Navigate to next image
    const goToNext = useCallback(() => {
        setCurrentIndex(prev => prev < images.length - 1 ? prev + 1 : 0);
        setIsZoomed(false);
    }, [images.length]);

    // Keyboard navigation
    useEffect(() => {
        const handleKey = (e) => {
            switch (e.key) {
                case 'Escape': onClose(); break;
                case 'ArrowLeft': if (hasMultiple) goToPrev(); break;
                case 'ArrowRight': if (hasMultiple) goToNext(); break;
                default: break;
            }
        };

        document.addEventListener('keydown', handleKey);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKey);
            document.body.style.overflow = '';
        };
    }, [onClose, goToPrev, goToNext, hasMultiple]);

    // Download image
    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = currentImage;
        link.download = `image_${currentIndex + 1}.jpg`;
        link.target = '_blank';
        link.click();
    };

    return (
        <div
            className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-fade-in"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            role="dialog"
            aria-modal="true"
            aria-label="Xem hình ảnh"
        >
            {/* Top bar controls */}
            <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-6 z-10 bg-gradient-to-b from-black/40 to-transparent">
                <div className="text-white/60 text-sm font-medium">
                    {hasMultiple && `${currentIndex + 1} / ${images.length}`}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsZoomed(!isZoomed)}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                        title={isZoomed ? 'Thu nhỏ' : 'Phóng to'}
                    >
                        <span className="material-symbols-outlined text-[22px]">
                            {isZoomed ? 'zoom_out' : 'zoom_in'}
                        </span>
                    </button>
                    <button
                        onClick={handleDownload}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                        title="Tải xuống"
                    >
                        <span className="material-symbols-outlined text-[22px]">download</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                        title="Đóng"
                    >
                        <span className="material-symbols-outlined text-[22px]">close</span>
                    </button>
                </div>
            </div>

            {/* Image */}
            <div className={`transition-transform duration-300 ${isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'}`} onClick={() => setIsZoomed(!isZoomed)}>
                <img
                    src={currentImage}
                    alt="Chat image"
                    className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl select-none"
                    draggable={false}
                />
            </div>

            {/* Navigation arrows */}
            {hasMultiple && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-all cursor-pointer backdrop-blur-sm"
                        aria-label="Ảnh trước"
                    >
                        <span className="material-symbols-outlined text-[28px]">chevron_left</span>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); goToNext(); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-all cursor-pointer backdrop-blur-sm"
                        aria-label="Ảnh tiếp"
                    >
                        <span className="material-symbols-outlined text-[28px]">chevron_right</span>
                    </button>
                </>
            )}

            {/* Thumbnail strip */}
            {hasMultiple && images.length <= 20 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-sm rounded-xl">
                    {images.map((img, i) => (
                        <button
                            key={i}
                            onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); setIsZoomed(false); }}
                            className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer flex-shrink-0 ${
                                i === currentIndex ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-80'
                            }`}
                        >
                            <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

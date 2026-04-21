/**
 * 📁 SATECO Chat — Supabase Storage Helpers
 * 
 * Upload, download, and manage chat files via Supabase Storage.
 * Bucket: "chat-files"
 */

import { supabase } from './supabase';

const BUCKET = 'chat-files';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const IMAGE_MAX_DIMENSION = 1920;

/**
 * Upload a file to chat storage
 * @param {File} file - The file to upload
 * @param {string} conversationId - Conversation UUID
 * @returns {Promise<{path: string, url: string, error: string|null}>}
 */
export async function uploadChatFile(file, conversationId) {
    if (!file || !conversationId) {
        return { path: null, url: null, error: 'Missing file or conversation ID' };
    }

    if (file.size > MAX_FILE_SIZE) {
        return { path: null, url: null, error: `File quá lớn. Giới hạn ${MAX_FILE_SIZE / 1024 / 1024}MB` };
    }

    try {
        // Compress images before upload
        let fileToUpload = file;
        if (file.type.startsWith('image/') && !file.type.includes('gif')) {
            fileToUpload = await compressImage(file);
        }

        // Generate unique path: conversationId/timestamp_filename
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${conversationId}/${timestamp}_${safeName}`;

        const { data, error } = await supabase.storage
            .from(BUCKET)
            .upload(filePath, fileToUpload, {
                cacheControl: '3600',
                upsert: false,
            });

        if (error) {
            console.error('[ChatStorage] Upload error:', error);
            return { path: null, url: null, error: error.message };
        }

        // Get signed URL (expires in 1 hour)
        const url = await getSignedUrl(data.path);
        return { path: data.path, url, error: null };
    } catch (err) {
        console.error('[ChatStorage] Upload exception:', err);
        return { path: null, url: null, error: err.message };
    }
}

/**
 * Get a signed URL for a file (1 hour expiry)
 * @param {string} filePath - Storage path
 * @returns {Promise<string|null>}
 */
export async function getSignedUrl(filePath) {
    if (!filePath) return null;
    
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(filePath, 3600); // 1 hour

        if (error) {
            console.error('[ChatStorage] SignedUrl error:', error);
            return null;
        }
        return data.signedUrl;
    } catch (err) {
        console.error('[ChatStorage] SignedUrl exception:', err);
        return null;
    }
}

/**
 * Get multiple signed URLs at once
 * @param {string[]} filePaths - Array of storage paths
 * @returns {Promise<Object<string, string>>} Map of path → signedUrl
 */
export async function getSignedUrls(filePaths) {
    if (!filePaths?.length) return {};

    try {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrls(filePaths, 3600);

        if (error) {
            console.error('[ChatStorage] Batch SignedUrl error:', error);
            return {};
        }

        const urlMap = {};
        data.forEach(item => {
            if (item.signedUrl) {
                urlMap[item.path] = item.signedUrl;
            }
        });
        return urlMap;
    } catch (err) {
        console.error('[ChatStorage] Batch SignedUrl exception:', err);
        return {};
    }
}

/**
 * Delete a file from chat storage
 * @param {string} filePath - Storage path
 * @returns {Promise<boolean>}
 */
export async function deleteChatFile(filePath) {
    if (!filePath) return false;

    try {
        const { error } = await supabase.storage
            .from(BUCKET)
            .remove([filePath]);

        if (error) {
            console.error('[ChatStorage] Delete error:', error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('[ChatStorage] Delete exception:', err);
        return false;
    }
}

/**
 * Compress an image file (resize to max dimension, reduce quality)
 * @param {File} file - Image file
 * @returns {Promise<File>}
 */
async function compressImage(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            let { width, height } = img;

            // Only resize if larger than max dimension
            if (width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION) {
                if (width > height) {
                    height = Math.round((height * IMAGE_MAX_DIMENSION) / width);
                    width = IMAGE_MAX_DIMENSION;
                } else {
                    width = Math.round((width * IMAGE_MAX_DIMENSION) / height);
                    height = IMAGE_MAX_DIMENSION;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (blob && blob.size < file.size) {
                        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                    } else {
                        resolve(file); // Keep original if compression didn't help
                    }
                },
                'image/jpeg',
                0.85
            );
        };

        img.onerror = () => resolve(file); // Fallback to original
        img.src = URL.createObjectURL(file);
    });
}

/**
 * Get file icon based on MIME type
 * @param {string} mimeType
 * @returns {string} Material icon name
 */
export function getFileIcon(mimeType) {
    if (!mimeType) return 'attach_file';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.includes('pdf')) return 'picture_as_pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'description';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'table_chart';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compressed')) return 'folder_zip';
    if (mimeType.includes('dwg') || mimeType.includes('autocad')) return 'architecture';
    return 'attach_file';
}

/**
 * Format file size for display
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

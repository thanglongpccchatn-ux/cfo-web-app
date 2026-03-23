/**
 * Audit Logging Utility
 * Ghi lại mọi thao tác quan trọng vào bảng audit_logs trên Supabase.
 * 
 * Usage:
 *   import { logAudit } from '../lib/auditLog';
 *   await logAudit({ action: 'UPDATE', tableName: 'projects', recordId: id, recordName: name, changes: { status: { old: 'Draft', new: 'Active' } } });
 */

import { supabase } from './supabase';

/**
 * Ghi log hành động vào bảng audit_logs
 * @param {Object} params
 * @param {'CREATE'|'UPDATE'|'DELETE'} params.action - Loại hành động
 * @param {string} params.tableName - Tên bảng bị ảnh hưởng
 * @param {string} [params.recordId] - ID bản ghi
 * @param {string} [params.recordName] - Tên hiển thị (VD: tên dự án)
 * @param {Object} [params.changes] - Chi tiết thay đổi { field: { old, new } }
 * @param {Object} [params.metadata] - Thông tin bổ sung
 */
export async function logAudit({ action, tableName, recordId, recordName, changes, metadata }) {
    try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; // Skip if not logged in

        // Get user profile for display name
        let userName = user.email;
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .single();
            if (profile?.full_name) userName = profile.full_name;
        } catch { /* ignore */ }

        const { error } = await supabase.from('audit_logs').insert([{
            user_id: user.id,
            user_email: user.email,
            user_name: userName,
            action,
            table_name: tableName,
            record_id: recordId || null,
            record_name: recordName || null,
            changes: changes || null,
            metadata: metadata || null,
        }]);

        if (error) {
            console.warn('Audit log failed (non-blocking):', error.message);
        }
    } catch (err) {
        // Never let audit logging break the main flow
        console.warn('Audit log error (non-blocking):', err);
    }
}

/**
 * Helper: Tính diff giữa 2 objects (chỉ lấy các field thay đổi)
 * @param {Object} oldObj - Dữ liệu cũ
 * @param {Object} newObj - Dữ liệu mới
 * @param {string[]} [fields] - Chỉ so sánh các field này (optional)
 * @returns {Object|null} { field: { old, new } } hoặc null nếu không có thay đổi
 */
export function diffChanges(oldObj, newObj, fields) {
    const keysToCheck = fields || Object.keys(newObj);
    const changes = {};
    
    for (const key of keysToCheck) {
        const oldVal = oldObj?.[key];
        const newVal = newObj?.[key];
        
        // Skip if both are null/undefined
        if (oldVal == null && newVal == null) continue;
        
        // Compare as strings to handle type differences (number vs string from DB)
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
            changes[key] = { old: oldVal ?? null, new: newVal ?? null };
        }
    }
    
    return Object.keys(changes).length > 0 ? changes : null;
}

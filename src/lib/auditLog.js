/**
 * 📋 Audit Logging Utility — Enhanced Edition
 * 
 * Upgraded with patterns from VietERP's @vierp/audit package:
 * - Batch logging (buffer + periodic flush) for better performance
 * - Structured action categories & severity levels  
 * - Session context (IP proxy, browser, page)
 * - diff helper for tracking field-level changes
 * - Non-blocking: Never breaks the main application flow
 * 
 * Usage:
 *   import { logAudit, diffChanges, AuditAction } from '../lib/auditLog';
 *   await logAudit({
 *     action: AuditAction.UPDATE, 
 *     tableName: 'projects', 
 *     recordId: id, 
 *     recordName: name,
 *     severity: 'medium',
 *     changes: diffChanges(oldData, newData, ['status', 'amount']),
 *   });
 */

import { supabase } from './supabase';

// ═══════════════════════════════════════════════════════
// CONSTANTS & ENUMS
// ═══════════════════════════════════════════════════════

/** @enum {string} Structured action types */
export const AuditAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  VIEW:   'VIEW',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
  LOGIN:  'LOGIN',
  LOGOUT: 'LOGOUT',
  APPROVE: 'APPROVE',
  REJECT:  'REJECT',
  TRANSFER: 'TRANSFER',
};

/** @enum {string} Severity levels — for filtering & alerting */
export const AuditSeverity = {
  LOW:      'low',       // View, export
  MEDIUM:   'medium',    // Create, update
  HIGH:     'high',      // Delete, approve, transfer money
  CRITICAL: 'critical',  // Bulk delete, role change, settings change
};

// ═══════════════════════════════════════════════════════
// BATCH BUFFER — Inspired by @vierp/audit batch pattern
// ═══════════════════════════════════════════════════════

const BUFFER = [];
const FLUSH_INTERVAL = 15000;  // 15 seconds
const MAX_BUFFER_SIZE = 10;    // Force flush at 10 entries
let flushTimer = null;
let cachedUser = null;

/**
 * Get cached user (avoid redundant auth calls)
 */
async function getCachedUser() {
  if (cachedUser) return cachedUser;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    let userName = user.email;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (profile?.full_name) userName = profile.full_name;
    } catch { /* ignore */ }

    cachedUser = { id: user.id, email: user.email, name: userName };
    
    // Invalidate cache after 5 minutes
    setTimeout(() => { cachedUser = null; }, 300000);
    
    return cachedUser;
  } catch {
    return null;
  }
}

/**
 * Flush buffered logs to Supabase
 */
async function flushBuffer() {
  if (BUFFER.length === 0) return;
  
  const batch = BUFFER.splice(0, BUFFER.length);
  
  try {
    const { error } = await supabase.from('audit_logs').insert(batch);
    if (error) {
      console.warn('[Audit] Batch flush failed:', error.message);
    }
  } catch (err) {
    console.warn('[Audit] Batch flush error:', err);
  }
}

function ensureFlushTimer() {
  if (!flushTimer) {
    flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL);
  }
}

// Flush before tab close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushBuffer);
}

// ═══════════════════════════════════════════════════════
// CORE LOGGING
// ═══════════════════════════════════════════════════════

/**
 * Ghi log hành động vào bảng audit_logs
 * 
 * @param {Object} params
 * @param {string} params.action - Loại hành động (dùng AuditAction enum)
 * @param {string} params.tableName - Tên bảng bị ảnh hưởng
 * @param {string} [params.recordId] - ID bản ghi
 * @param {string} [params.recordName] - Tên hiển thị (VD: tên dự án)
 * @param {Object} [params.changes] - Chi tiết thay đổi { field: { old, new } }
 * @param {Object} [params.metadata] - Thông tin bổ sung
 * @param {string} [params.severity='medium'] - Mức độ quan trọng
 * @param {boolean} [params.immediate=false] - Force immediate insert (skip buffer)
 */
export async function logAudit({ 
  action, 
  tableName, 
  recordId, 
  recordName, 
  changes, 
  metadata,
  severity = AuditSeverity.MEDIUM,
  immediate = false,
}) {
  try {
    const user = await getCachedUser();
    if (!user) return;

    const entry = {
      user_id: user.id,
      user_email: user.email,
      user_name: user.name,
      action,
      table_name: tableName,
      record_id: recordId || null,
      record_name: recordName || null,
      changes: changes || null,
      metadata: {
        ...(metadata || {}),
        severity,
        page_url: typeof window !== 'undefined' ? window.location.pathname : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 200) : null,
      },
    };

    // Critical/high severity or explicit immediate → insert now
    if (immediate || severity === AuditSeverity.CRITICAL || severity === AuditSeverity.HIGH) {
      const { error } = await supabase.from('audit_logs').insert([entry]);
      if (error) console.warn('[Audit] Immediate insert failed:', error.message);
      return;
    }

    // Otherwise buffer for batch insert
    ensureFlushTimer();
    BUFFER.push(entry);

    if (BUFFER.length >= MAX_BUFFER_SIZE) {
      flushBuffer();
    }
  } catch (err) {
    // Never let audit logging break the main flow
    console.warn('[Audit] Error (non-blocking):', err);
  }
}

// ═══════════════════════════════════════════════════════
// DIFF HELPER
// ═══════════════════════════════════════════════════════

/**
 * Tính diff giữa 2 objects (chỉ lấy các field thay đổi)
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

// ═══════════════════════════════════════════════════════
// CONVENIENCE SHORTCUTS
// ═══════════════════════════════════════════════════════

/**
 * Quick log: CREATE action
 */
export const logCreate = (tableName, recordId, recordName, metadata) =>
  logAudit({ action: AuditAction.CREATE, tableName, recordId, recordName, metadata, severity: AuditSeverity.MEDIUM });

/**
 * Quick log: UPDATE action with auto-diff
 */
export const logUpdate = (tableName, recordId, recordName, oldData, newData, fields) =>
  logAudit({ 
    action: AuditAction.UPDATE, 
    tableName, 
    recordId, 
    recordName, 
    changes: diffChanges(oldData, newData, fields),
    severity: AuditSeverity.MEDIUM,
  });

/**
 * Quick log: DELETE action (always immediate — high severity)
 */
export const logDelete = (tableName, recordId, recordName, metadata) =>
  logAudit({ action: AuditAction.DELETE, tableName, recordId, recordName, metadata, severity: AuditSeverity.HIGH, immediate: true });

/**
 * Quick log: EXPORT action (data leaving the system)
 */
export const logExport = (tableName, recordCount, format = 'xlsx') =>
  logAudit({ 
    action: AuditAction.EXPORT, 
    tableName, 
    metadata: { record_count: recordCount, format },
    severity: AuditSeverity.MEDIUM,
  });

/**
 * Quick log: Financial transfer (always critical)
 */
export const logTransfer = (recordId, recordName, amount, metadata) =>
  logAudit({ 
    action: AuditAction.TRANSFER, 
    tableName: 'internal_payment_history', 
    recordId, 
    recordName,
    metadata: { ...metadata, amount },
    severity: AuditSeverity.CRITICAL,
    immediate: true,
  });

// ═══════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════

export function destroyAuditLogger() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flushBuffer();
  cachedUser = null;
}

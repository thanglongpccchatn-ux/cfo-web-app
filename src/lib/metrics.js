/**
 * 📊 SATECO — Business Metrics & Performance Tracking
 * 
 * Inspired by VietERP's @vierp/metrics package (Prometheus-style),
 * adapted as a lightweight Supabase-based metrics system for CFO App.
 * 
 * Tracks:
 * - Business KPIs (revenue, debt, cash flow)
 * - User activity (page views, actions per module)
 * - Performance (page load times, API response times)
 * - Financial alerts (overdue payments, low cash, high debt ratio)
 * 
 * Usage:
 *   import { Metrics } from '../lib/metrics';
 *   Metrics.track('payment_created', { projectId, amount });
 *   Metrics.timer.start('page_load');
 *   // ... later
 *   Metrics.timer.end('page_load', { page: '/dashboard' });
 */

import { supabase } from './supabase';

// ═══════════════════════════════════════════════════════
// IN-MEMORY BUFFER — Batch insert để giảm DB calls
// ═══════════════════════════════════════════════════════

const BUFFER = [];
const FLUSH_INTERVAL = 30000;   // 30 giây
const MAX_BUFFER_SIZE = 20;     // Max 20 events trước khi flush
const TIMERS = new Map();

let flushTimer = null;

/**
 * Flush buffer vào Supabase
 */
async function flushBuffer() {
  if (BUFFER.length === 0) return;

  const batch = BUFFER.splice(0, BUFFER.length);

  try {
    const { error } = await supabase.from('app_metrics').insert(batch);
    if (error) {
      console.warn('[Metrics] Flush failed:', error.message);
      // Don't re-add to buffer — metrics are non-critical
    }
  } catch (err) {
    console.warn('[Metrics] Flush error:', err);
  }
}

function ensureFlushTimer() {
  if (!flushTimer) {
    flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL);
  }
}

// ═══════════════════════════════════════════════════════
// CORE TRACKING
// ═══════════════════════════════════════════════════════

/**
 * Track a business event/metric
 * @param {string} eventName - Event name (e.g. 'payment_created', 'contract_viewed')
 * @param {Object} [data={}] - Additional context
 * @param {number} [value=1] - Numeric value (amount, duration, count)
 */
function track(eventName, data = {}, value = 1) {
  ensureFlushTimer();

  const entry = {
    event_name: eventName,
    event_value: value,
    event_data: data,
    page_url: typeof window !== 'undefined' ? window.location.pathname : null,
    recorded_at: new Date().toISOString(),
  };

  // Add user context (non-blocking)
  try {
    const session = JSON.parse(localStorage.getItem('sb-session') || '{}');
    entry.user_id = session?.user?.id || null;
  } catch { /* ignore */ }

  BUFFER.push(entry);

  // Auto-flush if buffer is full
  if (BUFFER.length >= MAX_BUFFER_SIZE) {
    flushBuffer();
  }
}

// ═══════════════════════════════════════════════════════
// TIMER — Measure durations (page load, API calls)
// ═══════════════════════════════════════════════════════

const timer = {
  /**
   * Start a named timer
   * @param {string} name - Timer name
   */
  start(name) {
    TIMERS.set(name, performance.now());
  },

  /**
   * End a timer and track the duration
   * @param {string} name - Timer name
   * @param {Object} [metadata={}] - Additional context
   * @returns {number} Duration in ms
   */
  end(name, metadata = {}) {
    const start = TIMERS.get(name);
    if (!start) return 0;
    
    const duration = Math.round(performance.now() - start);
    TIMERS.delete(name);

    track(`timer_${name}`, { ...metadata, duration_ms: duration }, duration);
    return duration;
  },
};

// ═══════════════════════════════════════════════════════
// FINANCIAL ALERTS — Auto-detect business anomalies
// ═══════════════════════════════════════════════════════

/**
 * Chạy kiểm tra sức khoẻ tài chính cho 1 project
 * @param {Object} financials - Output từ computeProjectFinancials()
 * @param {Object} project - Project record
 * @returns {Array<{ level: 'info'|'warning'|'critical', code: string, message: string }>}
 */
function checkFinancialHealth(financials, project) {
  const alerts = [];
  const f = financials;

  // 🔴 Critical: Thu hồi vốn < 30% nhưng dự án đã quá 70% thời gian
  if (f.recoveryRate < 30 && project.start_date && project.end_date) {
    const total = new Date(project.end_date) - new Date(project.start_date);
    const elapsed = new Date() - new Date(project.start_date);
    if (total > 0 && (elapsed / total) > 0.7) {
      alerts.push({
        level: 'critical',
        code: 'LOW_RECOVERY_LATE_PROJECT',
        message: `Thu hồi vốn chỉ ${f.recoveryRate.toFixed(1)}% nhưng đã quá 70% thời gian dự án`,
      });
    }
  }

  // 🔴 Critical: Lỗ ròng (chi > thu * tỷ lệ thực tế)
  if (f.profit < 0 && Math.abs(f.profit) > 100000000) { // Lỗ > 100 triệu
    alerts.push({
      level: 'critical',
      code: 'NET_LOSS',
      message: `Dự án đang lỗ ${Math.abs(f.profit).toLocaleString('vi-VN')} ₫`,
    });
  }

  // 🟡 Warning: Công nợ hóa đơn > 50% giá trị HĐ
  if (f.totalValuePostVat > 0 && f.debtInvoice > f.totalValuePostVat * 0.5) {
    alerts.push({
      level: 'warning',
      code: 'HIGH_INVOICE_DEBT',
      message: `Công nợ HĐ chiếm ${((f.debtInvoice / f.totalValuePostVat) * 100).toFixed(0)}% giá trị hợp đồng`,
    });
  }

  // 🟡 Warning: Chưa xuất hóa đơn nhưng đã chi > 500 triệu
  if (f.totalInvoice === 0 && f.totalExpenses > 500000000) {
    alerts.push({
      level: 'warning',
      code: 'EXPENSES_WITHOUT_INVOICE',
      message: `Đã chi ${(f.totalExpenses / 1e6).toFixed(0)} triệu nhưng chưa xuất hóa đơn nào`,
    });
  }

  // ℹ️ Info: Tỷ lệ thu/chi tốt (> 1.5)
  if (f.totalExpenses > 0 && f.totalIncome / f.totalExpenses > 1.5) {
    alerts.push({
      level: 'info',
      code: 'HEALTHY_CASH_RATIO',
      message: `Tỷ lệ thu/chi đạt ${(f.totalIncome / f.totalExpenses).toFixed(2)} — tình hình tài chính tốt`,
    });
  }

  return alerts;
}

// ═══════════════════════════════════════════════════════
// PAGE ANALYTICS — Track navigation patterns
// ═══════════════════════════════════════════════════════

/**
 * Track page view (gọi trong useEffect ở mỗi page)
 * @param {string} pageName - Tên trang
 */
function trackPageView(pageName) {
  track('page_view', { page: pageName });
}

/**
 * Track user action on a module
 * @param {string} module - Module name (e.g. 'contracts', 'payments')
 * @param {string} action - Action (e.g. 'create', 'update', 'delete', 'export')
 * @param {Object} [context={}] - Additional context
 */
function trackAction(module, action, context = {}) {
  track('user_action', { module, action, ...context });
}

// ═══════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════

/**
 * Force flush và cleanup (gọi khi app unmount)
 */
function destroy() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flushBuffer(); // Final flush
}

// Flush trước khi tab đóng
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushBuffer();
  });
}

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

export const Metrics = {
  track,
  timer,
  trackPageView,
  trackAction,
  checkFinancialHealth,
  flush: flushBuffer,
  destroy,
};

export default Metrics;

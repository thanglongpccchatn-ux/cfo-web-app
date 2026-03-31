/**
 * 🔔 SATECO — Cross-Module Event Bus
 * 
 * Inspired by VietERP's @vierp/events (NATS JetStream),
 * adapted using Supabase Realtime Channels for the CFO App.
 * 
 * Provides pub/sub pattern for real-time cross-module communication:
 * - Payment created → Notify CFO + Update Dashboard KPIs
 * - Contract status → Notify PM + Refresh Overview
 * - Material received → Update Inventory + Log expense
 * - Overdue alert → Notify relevant managers
 * 
 * Usage:
 *   import { EventBus } from '../lib/eventBus';
 *   
 *   // Subscribe (in useEffect)
 *   const unsub = EventBus.on('payment:created', (payload) => { ... });
 *   return () => unsub();
 *   
 *   // Publish
 *   EventBus.emit('payment:created', { projectId, amount, stage });
 */

import { supabase } from './supabase';

// ═══════════════════════════════════════════════════════
// LOCAL EVENT EMITTER (for same-tab communication)
// ═══════════════════════════════════════════════════════

const listeners = new Map();

/**
 * Subscribe to an event
 * @param {string} event - Event name (e.g. 'payment:created')
 * @param {Function} callback - Handler function
 * @returns {Function} Unsubscribe function
 */
function on(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);

  // Return unsubscribe function
  return () => {
    const set = listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) listeners.delete(event);
    }
  };
}

/**
 * Emit an event locally (same tab only)
 * @param {string} event - Event name
 * @param {Object} payload - Event data
 */
function emit(event, payload = {}) {
  const eventListeners = listeners.get(event);
  if (eventListeners) {
    const enrichedPayload = {
      ...payload,
      _event: event,
      _timestamp: new Date().toISOString(),
    };
    eventListeners.forEach(cb => {
      try {
        cb(enrichedPayload);
      } catch (err) {
        console.warn(`[EventBus] Handler error for "${event}":`, err);
      }
    });
  }
}

// ═══════════════════════════════════════════════════════
// SUPABASE REALTIME BRIDGE (for cross-tab/cross-user)
// ═══════════════════════════════════════════════════════

let realtimeChannel = null;

/**
 * Khởi tạo Realtime channel cho broadcast events
 * Gọi một lần khi app mount.
 */
function initRealtimeBridge() {
  if (realtimeChannel) return; // Already initialized

  realtimeChannel = supabase
    .channel('sateco_events', {
      config: { broadcast: { self: false } }, // Don't receive own broadcasts
    })
    .on('broadcast', { event: 'app_event' }, ({ payload }) => {
      // Re-emit locally so all subscribers get it
      if (payload?.event) {
        emit(payload.event, payload.data || {});
      }
    })
    .subscribe();
}

/**
 * Broadcast event to all connected clients via Supabase Realtime
 * @param {string} event - Event name
 * @param {Object} data - Event payload
 */
async function broadcast(event, data = {}) {
  // Emit locally first (instant)
  emit(event, data);

  // Then broadcast to other tabs/users
  if (realtimeChannel) {
    try {
      await realtimeChannel.send({
        type: 'broadcast',
        event: 'app_event',
        payload: { event, data },
      });
    } catch (err) {
      console.warn('[EventBus] Broadcast failed:', err);
    }
  }
}

// ═══════════════════════════════════════════════════════
// DB TABLE LISTENERS — Auto-emit on DB changes
// ═══════════════════════════════════════════════════════

const tableChannels = new Map();

/**
 * Watch a Supabase table for changes and auto-emit events
 * @param {string} tableName - Table to watch
 * @param {Object} [options={}]
 * @param {string} [options.filter] - Supabase filter (e.g. 'project_id=eq.123')
 * @param {string[]} [options.events=['INSERT','UPDATE','DELETE']] - Which events
 * @returns {Function} Unsubscribe function
 */
function watchTable(tableName, options = {}) {
  const { filter, events = ['INSERT', 'UPDATE', 'DELETE'] } = options;
  const channelName = `db_${tableName}_${filter || 'all'}`;

  // Don't create duplicate channels
  if (tableChannels.has(channelName)) {
    return tableChannels.get(channelName).unsubscribe;
  }

  const channelConfig = {
    event: '*',
    schema: 'public',
    table: tableName,
  };
  if (filter) channelConfig.filter = filter;

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', channelConfig, (payload) => {
      const eventType = payload.eventType.toLowerCase(); // insert, update, delete
      if (!events.includes(payload.eventType)) return;

      emit(`db:${tableName}:${eventType}`, {
        table: tableName,
        type: eventType,
        record: payload.new || payload.old,
        oldRecord: payload.old,
      });
    })
    .subscribe();

  const unsubscribe = () => {
    supabase.removeChannel(channel);
    tableChannels.delete(channelName);
  };

  tableChannels.set(channelName, { channel, unsubscribe });
  return unsubscribe;
}

// ═══════════════════════════════════════════════════════
// PRE-DEFINED BUSINESS EVENTS
// ═══════════════════════════════════════════════════════

/** @enum {string} */
export const EVENTS = {
  // Payment
  PAYMENT_CREATED:    'payment:created',
  PAYMENT_UPDATED:    'payment:updated', 
  PAYMENT_APPROVED:   'payment:approved',
  PAYMENT_RECEIVED:   'payment:received',

  // Contract
  CONTRACT_CREATED:   'contract:created',
  CONTRACT_UPDATED:   'contract:updated',
  CONTRACT_COMPLETED: 'contract:completed',

  // Material
  MATERIAL_RECEIVED:  'material:received',
  MATERIAL_ISSUED:    'material:issued',

  // Financial
  INVOICE_ISSUED:     'invoice:issued',
  EXPENSE_RECORDED:   'expense:recorded',

  // System
  DASHBOARD_REFRESH:  'system:dashboard_refresh',
  DATA_EXPORTED:      'system:data_exported',
  USER_ACTION:        'system:user_action',
};

// ═══════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════

function destroy() {
  // Remove all table watchers
  tableChannels.forEach(({ unsubscribe }) => unsubscribe());
  tableChannels.clear();

  // Remove realtime bridge
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  // Clear all listeners
  listeners.clear();
}

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

export const EventBus = {
  on,
  emit,
  broadcast,
  watchTable,
  initRealtimeBridge,
  destroy,
};

export default EventBus;

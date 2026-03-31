/**
 * 🎯 useMetrics — React hook for integrated metrics & events
 * 
 * Combines Metrics tracking + EventBus subscription into a single hook
 * that components can use to:
 * - Auto-track page views on mount
 * - Subscribe to cross-module events
 * - Track user actions with one-liner
 * - Get financial health alerts for a project
 * 
 * Usage:
 *   function PaymentTracking({ project }) {
 *     const { trackAction, onEvent, healthAlerts } = useMetrics('payment_tracking', project);
 *     
 *     // Subscribe to events
 *     onEvent(EVENTS.PAYMENT_CREATED, (payload) => refreshData());
 *     
 *     // Track actions
 *     const handleCreate = async () => {
 *       await createPayment();
 *       trackAction('create', { amount: 1000000 });
 *     };
 *   }
 */

import { useEffect, useRef, useCallback } from 'react';
import { Metrics } from '../lib/metrics';
import { EventBus, EVENTS } from '../lib/eventBus';

/**
 * @param {string} moduleName - Module/page name for tracking context
 * @param {Object} [projectFinancials=null] - Output from computeProjectFinancials() for health checks
 * @param {Object} [project=null] - Project record for health checks
 */
export function useMetrics(moduleName, projectFinancials = null, project = null) {
  const unsubscribers = useRef([]);
  const hasTrackedPageView = useRef(false);

  // Auto-track page view on mount (once per module instance)
  useEffect(() => {
    if (!hasTrackedPageView.current) {
      Metrics.trackPageView(moduleName);
      Metrics.timer.start(`page_${moduleName}`);
      hasTrackedPageView.current = true;
    }
    
    return () => {
      // End page timer on unmount
      Metrics.timer.end(`page_${moduleName}`, { module: moduleName });
      
      // Cleanup event subscriptions
      unsubscribers.current.forEach(unsub => unsub());
      unsubscribers.current = [];
    };
  }, [moduleName]);

  /**
   * Track a user action in this module
   */
  const trackAction = useCallback((action, context = {}) => {
    Metrics.trackAction(moduleName, action, context);
  }, [moduleName]);

  /**
   * Subscribe to an EventBus event (auto-cleanup on unmount)
   */
  const onEvent = useCallback((event, handler) => {
    const unsub = EventBus.on(event, handler);
    unsubscribers.current.push(unsub);
    return unsub;
  }, []);

  /**
   * Broadcast an event to all tabs/users
   */
  const broadcastEvent = useCallback((event, data = {}) => {
    EventBus.broadcast(event, { ...data, source: moduleName });
  }, [moduleName]);

  // Calculate financial health alerts if project data provided
  const healthAlerts = (projectFinancials && project)
    ? Metrics.checkFinancialHealth(projectFinancials, project)
    : [];

  return {
    trackAction,
    onEvent,
    broadcastEvent,
    healthAlerts,
    EVENTS,
  };
}

export default useMetrics;

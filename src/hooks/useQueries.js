/**
 * SATECO — Shared React Query Hooks
 * 
 * Centralized data-fetching hooks with automatic caching, deduplication, 
 * and background refetching. Import these instead of writing manual 
 * useState + useEffect + supabase.from() patterns.
 * 
 * Benefits:
 * - Automatic caching (5 min stale time)
 * - Request deduplication (same query only fires once)
 * - Background refetching when tab refocuses
 * - Loading/error states built-in
 * - Optimistic updates for mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ── Default query options ──
const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes
const DEFAULT_CACHE_TIME = 10 * 60 * 1000; // 10 minutes

// ══════════════════════════════════════
// ── PROJECTS / CONTRACTS ──
// ══════════════════════════════════════

/**
 * Fetch all projects with partner info
 * Used by: ContractMasterDetail, DashboardOverview, DocumentTracking, etc.
 */
export function useProjects(options = {}) {
    return useQuery({
        queryKey: ['projects'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('projects')
                .select('*, partners!projects_partner_id_fkey(id, name, short_name, code)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        staleTime: DEFAULT_STALE_TIME,
        gcTime: DEFAULT_CACHE_TIME,
        ...options,
    });
}

/**
 * Fetch a single project by ID
 */
export function useProject(projectId, options = {}) {
    return useQuery({
        queryKey: ['projects', projectId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('projects')
                .select('*, partners!projects_partner_id_fkey(id, name, short_name, code)')
                .eq('id', projectId)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!projectId,
        staleTime: DEFAULT_STALE_TIME,
        ...options,
    });
}

// ══════════════════════════════════════
// ── PAYMENTS ──
// ══════════════════════════════════════

/**
 * Fetch all payments (optionally filtered by project)
 * Used by: PaymentTracking, PaymentsMaster, DocumentTracking, etc.
 */
export function usePayments(projectId = null, options = {}) {
    return useQuery({
        queryKey: projectId ? ['payments', projectId] : ['payments'],
        queryFn: async () => {
            let query = supabase
                .from('payment_tracking')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (projectId) query = query.eq('project_id', projectId);
            
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        staleTime: DEFAULT_STALE_TIME,
        ...options,
    });
}

// ══════════════════════════════════════
// ── PARTNERS ──
// ══════════════════════════════════════

/**
 * Fetch all partners (clients, suppliers, etc.)
 * Used by: ContractCreate, PartnerManagement, SuppliersMaster
 */
export function usePartners(options = {}) {
    return useQuery({
        queryKey: ['partners'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('partners')
                .select('*')
                .order('name');
            if (error) throw error;
            return data || [];
        },
        staleTime: DEFAULT_STALE_TIME,
        ...options,
    });
}

// ══════════════════════════════════════
// ── PAYMENT HISTORY ──
// ══════════════════════════════════════

/**
 * Fetch external payment history (thu tiền từ CĐT)
 */
export function useExternalPaymentHistory(projectId = null, options = {}) {
    return useQuery({
        queryKey: projectId ? ['ext_payment_history', projectId] : ['ext_payment_history'],
        queryFn: async () => {
            let query = supabase
                .from('external_payment_history')
                .select('*')
                .order('payment_date', { ascending: false });
            
            if (projectId) query = query.eq('project_id', projectId);
            
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        staleTime: DEFAULT_STALE_TIME,
        ...options,
    });
}

/**
 * Fetch internal payment history (chi phí nội bộ Sateco)
 */
export function useInternalPaymentHistory(projectId = null, options = {}) {
    return useQuery({
        queryKey: projectId ? ['int_payment_history', projectId] : ['int_payment_history'],
        queryFn: async () => {
            let query = supabase
                .from('internal_payment_history')
                .select('*')
                .order('payment_date', { ascending: false });
            
            if (projectId) query = query.eq('project_id', projectId);
            
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        staleTime: DEFAULT_STALE_TIME,
        ...options,
    });
}

// ══════════════════════════════════════
// ── COMPANY SETTINGS & BANK ──
// ══════════════════════════════════════

/**
 * Fetch company settings (Thăng Long, Thành Phát, Sateco bank info etc.)
 */
export function useCompanySettings(options = {}) {
    return useQuery({
        queryKey: ['company_settings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('company_settings')
                .select('*');
            if (error) throw error;
            return data || [];
        },
        staleTime: 30 * 60 * 1000, // 30 min (rarely changes)
        ...options,
    });
}

/**
 * Fetch bank profiles
 */
export function useBankProfiles(options = {}) {
    return useQuery({
        queryKey: ['bank_profiles'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('bank_profiles')
                .select('*')
                .order('profile_name');
            if (error) throw error;
            return data || [];
        },
        staleTime: 30 * 60 * 1000,
        ...options,
    });
}

// ══════════════════════════════════════
// ── VARIATIONS (PHÁT SINH) ──
// ══════════════════════════════════════

export function useVariations(projectId = null, options = {}) {
    return useQuery({
        queryKey: projectId ? ['variations', projectId] : ['variations'],
        queryFn: async () => {
            let query = supabase
                .from('contract_variations')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (projectId) query = query.eq('project_id', projectId);
            
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        staleTime: DEFAULT_STALE_TIME,
        ...options,
    });
}

// ══════════════════════════════════════
// ── MATERIALS CATALOG ──
// ══════════════════════════════════════

export function useMaterialsCatalog(options = {}) {
    return useQuery({
        queryKey: ['materials_catalog'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('materials_catalog')
                .select('*')
                .order('name');
            if (error) throw error;
            return data || [];
        },
        staleTime: 15 * 60 * 1000, // 15 min
        ...options,
    });
}

// ══════════════════════════════════════
// ── LOANS (VAY VỐN) ──
// ══════════════════════════════════════

export function useLoans(options = {}) {
    return useQuery({
        queryKey: ['loans'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('loans')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        staleTime: DEFAULT_STALE_TIME,
        ...options,
    });
}

// ══════════════════════════════════════
// ── BIDDING (ĐẤU THẦU) ──
// ══════════════════════════════════════

export function useBids(options = {}) {
    return useQuery({
        queryKey: ['bids'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('bidding')
                .select('*, partners!bidding_client_id_fkey(id, name, short_name)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        staleTime: DEFAULT_STALE_TIME,
        ...options,
    });
}

// ══════════════════════════════════════
// ── GENERIC MUTATIONS ──
// ══════════════════════════════════════

/**
 * Generic upsert mutation that invalidates related queries.
 * 
 * Usage:
 *   const mutation = useUpsertMutation('projects', ['projects']);
 *   mutation.mutate({ id: '...', name: 'New Name' });
 */
export function useUpsertMutation(table, invalidateKeys = []) {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (payload) => {
            const { data, error } = await supabase
                .from(table)
                .upsert(payload)
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            invalidateKeys.forEach(key => {
                queryClient.invalidateQueries({ queryKey: [key] });
            });
        },
    });
}

/**
 * Generic delete mutation
 * 
 * Usage:
 *   const deleteMutation = useDeleteMutation('projects', ['projects']);
 *   deleteMutation.mutate(projectId);
 */
export function useDeleteMutation(table, invalidateKeys = []) {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase
                .from(table)
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            invalidateKeys.forEach(key => {
                queryClient.invalidateQueries({ queryKey: [key] });
            });
        },
    });
}

/**
 * Hook to get the query client for manual invalidation.
 * 
 * Usage:
 *   const invalidate = useInvalidateQueries();
 *   invalidate('projects'); // refresh projects cache
 */
export function useInvalidateQueries() {
    const queryClient = useQueryClient();
    return (key) => queryClient.invalidateQueries({ queryKey: [key] });
}

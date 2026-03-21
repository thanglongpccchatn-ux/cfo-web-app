import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://laoadqoisidnbgaqjsbw.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_HZhvUIQXNF99JLK7RGZBOA_Amkh_7Bf'

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("⚠️ Warning: Supabase URL or Anon Key is missing. Please check your .env file.")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: window.sessionStorage, // Fixes the Vite HMR multiple-tab lock deadlock and improves security
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
})

import { createClient } from '@supabase/supabase-client';
import fetch from 'node-fetch';

const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function check() {
    const url = `${VITE_SUPABASE_URL}/rest/v1/projects?code=eq.YADEA&select=code,sateco_contract_ratio,sateco_actual_ratio`;
    const response = await fetch(url, {
        headers: {
            'apikey': VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${VITE_SUPABASE_ANON_KEY}`
        }
    });
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
}

check();

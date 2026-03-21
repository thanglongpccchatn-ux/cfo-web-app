import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase
        .from('payments')
        .select('*')
        .ilike('payment_code', '%YADEA-IPC04%');
    
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

check();

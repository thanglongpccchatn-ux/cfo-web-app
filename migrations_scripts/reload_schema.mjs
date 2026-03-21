import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function reload() {
    console.log('Sending reload request...');
    // PostgREST listens to the pgrst channel for reload schema commands
    const { error } = await supabase.rpc('reload_schema_cache');
    if (error) {
        console.log('RPC reload failed, trying bare SQL notification...');
        // Not possible from user space, but we can try triggering a DDL change to force it
        const { error: ddlError } = await supabase.from('partners').select('id').limit(1);
        console.log('Read test:', ddlError || 'Success');
    } else {
        console.log('Success');
    }
}

reload();

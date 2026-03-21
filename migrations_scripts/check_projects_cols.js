
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkColumns() {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'projects' });
    if (error) {
        // If RPC doesn't exist, try a simple select with limit 0
        const { data: cols, error: err2 } = await supabase.from('projects').select('*').limit(1);
        if (err2) {
            console.error('Error fetching columns:', err2);
            return;
        }
        if (cols && cols.length > 0) {
            console.log('Columns:', Object.keys(cols[0]));
        } else {
            console.log('No data in projects to infer columns');
        }
    } else {
        console.log('Columns from RPC:', data);
    }
}

checkColumns();

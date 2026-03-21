import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env manually
const envPath = path.resolve(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
        envVars[key.trim()] = values.join('=').trim();
    }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    const payload = {
        name: 'CÔNG TY TNHH XÂY DỰNG ZYF VIỆT NAM',
        tax_code: '0107572987',
        address: 'Tầng 22',
        phone: '',
        email: '',
        representative: 'CHEN JING BO',
        representative_title: 'Tổng Giám đốc',
        bank_name: 'ICBC',
        bank_account: '0127000100000515948',
        type: 'Client'
    };

    console.log("Attempting to insert:", payload);
    const { data, error } = await supabase.from('partners').insert([payload]).select();
    
    if (error) {
        console.error("Insert failed with error:", JSON.stringify(error, null, 2));
    } else {
        console.log("Insert succeeded. Data:", data);
        
        // Clean up
        if (data && data.length > 0) {
           await supabase.from('partners').delete().eq('id', data[0].id);
           console.log("Deleted test record.");
        }
    }
}

testInsert();

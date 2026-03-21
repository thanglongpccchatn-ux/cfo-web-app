import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function checkColumns() {
    console.log("Fetching one partner record...");
    const { data, error } = await supabase.from('partners').select('*').limit(1);
    
    if (error) {
        console.error("Fetch failed:", error);
    } else {
        console.log("Data:", JSON.stringify(data, null, 2));
        if (data && data.length > 0) {
            console.log("Columns present in response:", Object.keys(data[0]));
            if (!Object.keys(data[0]).includes('status')) {
                console.log("❌ 'status' column is missing from the database schema!");
            }
        } else {
            console.log("No data found, but request succeeded.");
        }
    }
}

checkColumns();

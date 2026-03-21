const { createClient } = require('@supabase/supabase-client');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
    console.log('Running migration...');
    // We try to add columns one by one as SQL if exec_sql exists
    // If not, we'll inform the user.
    const sql = `
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS vat_percentage NUMERIC DEFAULT 8;
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS vat_amount NUMERIC DEFAULT 0;
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_value_post_vat NUMERIC DEFAULT 0;
    `;
    
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
        console.error('Migration failed:', error.message);
        console.log('Try running this SQL manually in Supabase SQL Editor:');
        console.log(sql);
    } else {
        console.log('Migration successful!');
    }
}

run();

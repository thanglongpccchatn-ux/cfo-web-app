/**
 * Run chat migration via Supabase Management API
 * Usage: node migrations_scripts/run_chat_migration.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^(\w+)="?(.+?)"?\s*$/);
    if (match) envVars[match[1]] = match[2];
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
// We need service_role key for admin operations. Try env or fallback.
const SUPABASE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_ANON_KEY;

console.log('🔗 Supabase URL:', SUPABASE_URL);
console.log('🔑 Using key type:', envVars.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Read migration SQL
const sqlPath = path.resolve(__dirname, '..', 'supabase', 'migrations', 'add_chat_tables.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('\n📄 Migration file:', sqlPath);
console.log(`📏 SQL length: ${sql.length} characters\n`);

// Split SQL into individual statements and run them
const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 5 && !s.startsWith('--'));

console.log(`🚀 Running ${statements.length} SQL statements...\n`);

let success = 0;
let failed = 0;

for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
    
    try {
        const { error } = await supabase.rpc('exec_sql', { query: stmt });
        
        if (error) {
            // Try via raw REST as fallback
            const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                },
                body: JSON.stringify({ query: stmt }),
            });
            
            if (!response.ok) {
                throw new Error(error.message || `HTTP ${response.status}`);
            }
        }
        
        console.log(`  ✅ [${i + 1}/${statements.length}] ${preview}...`);
        success++;
    } catch (err) {
        console.log(`  ❌ [${i + 1}/${statements.length}] ${preview}...`);
        console.log(`     Error: ${err.message}\n`);
        failed++;
    }
}

console.log(`\n📊 Results: ${success} success, ${failed} failed out of ${statements.length} statements`);

if (failed > 0) {
    console.log('\n⚠️  Some statements failed. You may need to run the migration manually:');
    console.log('    1. Open Supabase Dashboard → SQL Editor');
    console.log('    2. Copy content from: supabase/migrations/add_chat_tables.sql');
    console.log('    3. Paste and click Run');
}

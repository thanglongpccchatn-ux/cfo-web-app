import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^(\w+)="?(.+?)"?\s*$/);
    if (match) envVars[match[1]] = match[2];
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    console.log('Adding view_chat permission...');
    
    // 1. Check if permission exists
    let { data: perm } = await supabase.from('permissions').select('code').eq('code', 'view_chat').single();
    
    if (!perm) {
        const { error: insertPermError } = await supabase.from('permissions').insert({
            code: 'view_chat',
            name: 'Truy cập Tin nhắn',
            module: 'Tin nhắn nội bộ',
            description: 'Cho phép truy cập và sử dụng phân hệ Tin nhắn nội bộ'
        });
        if (insertPermError) {
            console.error('Error inserting permission:', insertPermError.message);
        } else {
            console.log('Granted view_chat permission to database');
        }
    } else {
        console.log('view_chat permission already exists.');
    }

    // 2. Fetch all role codes
    const { data: roles, error: rolesError } = await supabase.from('roles').select('code');
    if (rolesError) {
         console.error('Error fetching roles:', rolesError.message);
         return;
    }

    // 3. Grant to all roles
    let addedCount = 0;
    for (const role of roles) {
        // Check if role_permission exists
        const { data: existing } = await supabase.from('role_permissions')
            .select('*')
            .eq('role_code', role.code)
            .eq('permission_code', 'view_chat')
            .single();
            
        if (!existing) {
            await supabase.from('role_permissions').insert({
                role_code: role.code,
                permission_code: 'view_chat'
            });
            addedCount++;
        }
    }
    
    console.log(`Granted view_chat to ${addedCount} roles successfully!`);
}

run();

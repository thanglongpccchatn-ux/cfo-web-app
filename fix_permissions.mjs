// Temporary script — Run once to fix missing permissions
// Usage: node fix_permissions.mjs
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Read .env manually  
const env = {};
readFileSync('.env', 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function fixPermissions() {
    console.log('🔧 Fixing missing permissions...');

    const newPerms = [
        { code: 'view_contracts', name: 'Xem hợp đồng', module: 'Contracts', description: 'Quyền xem danh sách hợp đồng' },
        { code: 'view_payments', name: 'Xem thanh toán', module: 'Payments', description: 'Quyền xem lịch sử thanh toán' },
        { code: 'view_suppliers', name: 'Xem nhà cung cấp', module: 'Suppliers', description: 'Quyền xem NCC và vật tư' },
        { code: 'view_materials', name: 'Xem kho vật tư', module: 'WMS', description: 'Quyền xem kho, đề nghị VT' },
        { code: 'view_bids', name: 'Xem đấu thầu', module: 'Bidding', description: 'Quyền xem gói thầu' },
        { code: 'view_loans', name: 'Xem vay vốn', module: 'Loans', description: 'Quyền xem khoản vay' },
    ];

    for (const p of newPerms) {
        const { error } = await supabase.from('permissions').upsert(p, { onConflict: 'code' });
        if (error) console.warn(`  ⚠ ${p.code}:`, error.message);
        else console.log(`  ✅ ${p.code}`);
    }

    const assignments = [
        ...['view_contracts','view_payments','view_suppliers','view_materials','view_bids','view_loans'].map(p => ({ role_code: 'ROLE01', permission_code: p })),
        ...['view_contracts','view_payments','view_suppliers','view_materials','view_bids','view_loans'].map(p => ({ role_code: 'ROLE02', permission_code: p })),
        ...['view_dashboard','view_payments','view_suppliers','view_materials','view_contracts'].map(p => ({ role_code: 'KETOAN', permission_code: p })),
        ...['view_dashboard','manage_labor'].map(p => ({ role_code: 'NHANSU', permission_code: p })),
        ...['view_dashboard','view_bids','view_suppliers','view_contracts','manage_labor'].map(p => ({ role_code: 'DAUTHAU', permission_code: p })),
        ...['view_dashboard','view_suppliers','view_materials','view_payments','create_purchase_order'].map(p => ({ role_code: 'ROLE03', permission_code: p })),
        ...['view_dashboard','view_contracts','view_materials','view_suppliers'].map(p => ({ role_code: 'ROLE04', permission_code: p })),
        ...['view_dashboard','view_payments','view_suppliers','manage_payments'].map(p => ({ role_code: 'ROLE05', permission_code: p })),
        ...['view_contracts','view_payments','view_suppliers'].map(p => ({ role_code: 'ROLE06', permission_code: p })),
        ...['view_dashboard','view_materials','view_suppliers','manage_labor','manage_inventory'].map(p => ({ role_code: 'ROLE07', permission_code: p })),
        ...['view_materials','view_suppliers','manage_inventory'].map(p => ({ role_code: 'ROLE08', permission_code: p })),
        ...['view_materials','view_suppliers','manage_inventory','receive_goods'].map(p => ({ role_code: 'ROLE09', permission_code: p })),
        ...['view_dashboard','view_materials','view_suppliers','manage_inventory'].map(p => ({ role_code: 'ROLE10', permission_code: p })),
        ...['view_materials','manage_inventory'].map(p => ({ role_code: 'ROLE11', permission_code: p })),
    ];

    console.log(`\n📌 Assigning ${assignments.length} role-permissions...`);
    // Insert one by one to avoid conflict issues
    for (const a of assignments) {
        const { error } = await supabase.from('role_permissions').insert(a);
        if (error && !error.message.includes('duplicate')) console.warn(`  ⚠ ${a.role_code}/${a.permission_code}:`, error.message);
    }

    console.log('\n✅ Done! Permissions fixed.');
}

fixPermissions().catch(console.error);

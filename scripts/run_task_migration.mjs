/**
 * Run Task Management migration via Supabase REST API
 * Uses the supabase-js client with anon key
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://laoadqoisidnbgaqjsbw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_HZhvUIQXNF99JLK7RGZBOA_Amkh_7Bf';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runMigration() {
    console.log('🚀 Starting Task Management migration...\n');

    // Step 1: Check if task_categories table exists by trying to query it
    console.log('1️⃣ Checking task_categories table...');
    const { data: catCheck, error: catErr } = await supabase.from('task_categories').select('id').limit(1);
    
    if (catErr && catErr.code === '42P01') {
        console.log('   ❌ Table does not exist yet. Please run the SQL migration manually in Supabase SQL Editor.');
        console.log('   📋 Copy the SQL from: supabase/migrations/add_task_management.sql');
        console.log('   🔗 Go to: https://supabase.com/dashboard/project/laoadqoisidnbgaqjsbw/sql/new\n');
        return;
    } else if (catErr) {
        console.log(`   ⚠️ Error: ${catErr.message} (code: ${catErr.code})`);
        console.log('   Table may not exist. Need to create via SQL Editor.\n');
    } else {
        console.log(`   ✅ task_categories exists (${catCheck?.length || 0} rows found)`);
        
        // Seed default categories if empty
        if (!catCheck || catCheck.length === 0) {
            console.log('   📌 Seeding default categories...');
            const defaults = [
                { name: 'Đấu thầu', icon: 'gavel', color: '#6366f1', sort_order: 1 },
                { name: 'Mua sắm vật tư', icon: 'shopping_cart', color: '#8b5cf6', sort_order: 2 },
                { name: 'Thanh toán', icon: 'payments', color: '#ec4899', sort_order: 3 },
                { name: 'Hợp đồng', icon: 'description', color: '#f59e0b', sort_order: 4 },
                { name: 'Khối lượng', icon: 'straighten', color: '#14b8a6', sort_order: 5 },
                { name: 'Thiết kế', icon: 'design_services', color: '#3b82f6', sort_order: 6 },
                { name: 'Thi công', icon: 'construction', color: '#ef4444', sort_order: 7 },
                { name: 'Nghiệm thu', icon: 'fact_check', color: '#10b981', sort_order: 8 },
                { name: 'Hành chính', icon: 'apartment', color: '#64748b', sort_order: 9 },
            ];
            const { data: seeded, error: seedErr } = await supabase.from('task_categories').insert(defaults).select();
            if (seedErr) console.log(`   ❌ Seed error: ${seedErr.message}`);
            else console.log(`   ✅ Seeded ${seeded.length} categories`);
        }
    }

    // Step 2: Check tasks table
    console.log('\n2️⃣ Checking tasks table...');
    const { data: taskCheck, error: taskErr } = await supabase.from('tasks').select('id').limit(1);
    if (taskErr) {
        console.log(`   ⚠️ Error: ${taskErr.message} (code: ${taskErr.code})`);
    } else {
        console.log(`   ✅ tasks table exists (${taskCheck?.length || 0} rows found)`);
    }

    // Step 3: Check task_comments table  
    console.log('\n3️⃣ Checking task_comments table...');
    const { data: commCheck, error: commErr } = await supabase.from('task_comments').select('id').limit(1);
    if (commErr) {
        console.log(`   ⚠️ Error: ${commErr.message} (code: ${commErr.code})`);
    } else {
        console.log(`   ✅ task_comments table exists`);
    }

    // Step 4: Check task_attachments table
    console.log('\n4️⃣ Checking task_attachments table...');
    const { data: attCheck, error: attErr } = await supabase.from('task_attachments').select('id').limit(1);
    if (attErr) {
        console.log(`   ⚠️ Error: ${attErr.message} (code: ${attErr.code})`);
    } else {
        console.log(`   ✅ task_attachments table exists`);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    const allOk = !catErr && !taskErr && !commErr && !attErr;
    if (allOk) {
        console.log('✅ All tables exist and are accessible!');
        
        // List categories
        const { data: cats } = await supabase.from('task_categories').select('*').order('sort_order');
        if (cats?.length > 0) {
            console.log(`\n📂 Categories (${cats.length}):`);
            cats.forEach(c => console.log(`   • ${c.name} (${c.icon}, ${c.color})`));
        }
    } else {
        console.log('❌ Some tables are missing. Run the SQL migration manually:');
        console.log('   🔗 https://supabase.com/dashboard/project/laoadqoisidnbgaqjsbw/sql/new');
        console.log('   📋 Copy SQL from: supabase/migrations/add_task_management.sql');
    }
}

runMigration().catch(console.error);

/**
 * Migration: Gộp module BIDDING và ĐẤU THẦU thành 1 module duy nhất
 * 
 * Vấn đề: Trong bảng permissions, một số records dùng module = 'BIDDING'
 * và một số dùng module = 'ĐẤU THẦU'. Cả 2 đều cùng 1 chức năng.
 * 
 * Giải pháp: UPDATE tất cả records có module = 'BIDDING' thành 'ĐẤU THẦU'
 * để thống nhất tên module bằng tiếng Việt.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://laoadqoisidnbgaqjsbw.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_HZhvUIQXNF99JLK7RGZBOA_Amkh_7Bf';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    console.log('🔍 Kiểm tra dữ liệu permissions hiện tại...\n');

    // 1. Liệt kê tất cả modules hiện tại
    const { data: allPerms, error: fetchErr } = await supabase
        .from('permissions')
        .select('code, module, name')
        .order('module');

    if (fetchErr) {
        console.error('❌ Lỗi lấy dữ liệu:', fetchErr.message);
        return;
    }

    // Group by module
    const byModule = {};
    allPerms.forEach(p => {
        if (!byModule[p.module]) byModule[p.module] = [];
        byModule[p.module].push(p);
    });

    console.log('📋 Danh sách modules hiện tại:');
    Object.entries(byModule).forEach(([mod, perms]) => {
        console.log(`  ${mod} (${perms.length} permissions)`);
        perms.forEach(p => console.log(`    - ${p.code}: ${p.name}`));
    });

    // 2. Check if Bidding module exists (separate from ĐẤU THẦU)
    const biddingPerms = byModule['Bidding'];
    if (!biddingPerms || biddingPerms.length === 0) {
        console.log('\n✅ Không tìm thấy module "Bidding" riêng biệt. Không cần gộp.');
        return;
    }

    console.log(`\n🔄 Tìm thấy ${biddingPerms.length} permissions dùng module "Bidding". Đang gộp vào "ĐẤU THẦU"...`);

    // 3. Update Bidding -> ĐẤU THẦU
    const { data: updated, error: updateErr } = await supabase
        .from('permissions')
        .update({ module: 'ĐẤU THẦU' })
        .eq('module', 'Bidding')
        .select();

    if (updateErr) {
        console.error('❌ Lỗi cập nhật:', updateErr.message);
        return;
    }

    console.log(`✅ Đã gộp ${updated.length} permissions từ "BIDDING" → "ĐẤU THẦU"`);

    // 4. Verify
    const { data: verify } = await supabase
        .from('permissions')
        .select('code, module, name')
        .in('module', ['BIDDING', 'ĐẤU THẦU'])
        .order('module');

    console.log('\n📋 Kết quả sau khi gộp:');
    verify.forEach(p => console.log(`  [${p.module}] ${p.code}: ${p.name}`));
}

run().catch(console.error);

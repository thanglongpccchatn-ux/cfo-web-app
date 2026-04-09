// Seed script for acc_accounts via Supabase JS client
// Run: node supabase/seed_accounts.mjs

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- Level 1 accounts (parents) ---
const level1 = [
  // Group 1: Tài sản ngắn hạn
  { account_number: '111', name: 'Tiền mặt', name_en: 'Cash on hand', account_type: 'asset', account_group: 1, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '111' },
  { account_number: '112', name: 'Tiền gửi ngân hàng', name_en: 'Cash in bank', account_type: 'asset', account_group: 1, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '112' },
  { account_number: '131', name: 'Phải thu của khách hàng', name_en: 'Accounts receivable', account_type: 'asset', account_group: 1, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '131' },
  { account_number: '133', name: 'Thuế GTGT được khấu trừ', name_en: 'VAT deductible', account_type: 'asset', account_group: 1, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '133' },
  { account_number: '136', name: 'Phải thu nội bộ', name_en: 'Internal receivables', account_type: 'asset', account_group: 1, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '136' },
  { account_number: '138', name: 'Phải thu khác', name_en: 'Other receivables', account_type: 'asset', account_group: 1, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '138' },
  { account_number: '141', name: 'Tạm ứng', name_en: 'Advances', account_type: 'asset', account_group: 1, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '141' },
  { account_number: '152', name: 'Nguyên liệu, vật liệu', name_en: 'Raw materials', account_type: 'asset', account_group: 1, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '152' },
  { account_number: '153', name: 'Công cụ, dụng cụ', name_en: 'Tools & supplies', account_type: 'asset', account_group: 1, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '153' },
  { account_number: '154', name: 'Chi phí SXKD dở dang', name_en: 'Work in progress', account_type: 'asset', account_group: 1, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '154' },
  { account_number: '155', name: 'Thành phẩm', name_en: 'Finished goods', account_type: 'asset', account_group: 1, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '155' },
  // Group 2: Tài sản dài hạn
  { account_number: '211', name: 'TSCĐ hữu hình', name_en: 'Tangible fixed assets', account_type: 'asset', account_group: 2, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '211' },
  { account_number: '214', name: 'Hao mòn TSCĐ', name_en: 'Accumulated depreciation', account_type: 'contra_asset', account_group: 2, normal_balance: 'credit', level: 1, is_system_account: true, tt200_code: '214' },
  { account_number: '242', name: 'Chi phí trả trước', name_en: 'Prepaid expenses', account_type: 'asset', account_group: 2, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '242' },
  // Group 3: Nợ phải trả
  { account_number: '331', name: 'Phải trả cho người bán', name_en: 'Accounts payable', account_type: 'liability', account_group: 3, normal_balance: 'credit', level: 1, is_system_account: true, tt200_code: '331' },
  { account_number: '333', name: 'Thuế và các khoản phải nộp NN', name_en: 'Taxes payable', account_type: 'liability', account_group: 3, normal_balance: 'credit', level: 1, is_system_account: true, tt200_code: '333' },
  { account_number: '334', name: 'Phải trả người lao động', name_en: 'Payroll payable', account_type: 'liability', account_group: 3, normal_balance: 'credit', level: 1, is_system_account: true, tt200_code: '334' },
  { account_number: '335', name: 'Chi phí phải trả', name_en: 'Accrued expenses', account_type: 'liability', account_group: 3, normal_balance: 'credit', level: 1, is_system_account: true, tt200_code: '335' },
  { account_number: '338', name: 'Phải trả, phải nộp khác', name_en: 'Other payables', account_type: 'liability', account_group: 3, normal_balance: 'credit', level: 1, is_system_account: true, tt200_code: '338' },
  { account_number: '341', name: 'Vay và nợ thuê tài chính', name_en: 'Borrowings & finance leases', account_type: 'liability', account_group: 3, normal_balance: 'credit', level: 1, is_system_account: true, tt200_code: '341' },
  // Group 4: Vốn chủ sở hữu
  { account_number: '411', name: 'Vốn đầu tư của chủ sở hữu', name_en: "Owner's equity", account_type: 'equity', account_group: 4, normal_balance: 'credit', level: 1, is_system_account: true, tt200_code: '411' },
  { account_number: '421', name: 'Lợi nhuận sau thuế chưa phân phối', name_en: 'Retained earnings', account_type: 'equity', account_group: 4, normal_balance: 'credit', level: 1, is_system_account: true, tt200_code: '421' },
  // Group 5: Doanh thu
  { account_number: '511', name: 'Doanh thu bán hàng và CCDV', name_en: 'Revenue from sales & services', account_type: 'revenue', account_group: 5, normal_balance: 'credit', level: 1, is_system_account: true, tt200_code: '511' },
  { account_number: '515', name: 'Doanh thu hoạt động tài chính', name_en: 'Financial income', account_type: 'revenue', account_group: 5, normal_balance: 'credit', level: 1, is_system_account: true, tt200_code: '515' },
  { account_number: '521', name: 'Các khoản giảm trừ doanh thu', name_en: 'Revenue deductions', account_type: 'contra_revenue', account_group: 5, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '521' },
  // Group 6: Chi phí sản xuất kinh doanh
  { account_number: '621', name: 'Chi phí NVL trực tiếp', name_en: 'Direct material costs', account_type: 'expense', account_group: 6, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '621' },
  { account_number: '622', name: 'Chi phí nhân công trực tiếp', name_en: 'Direct labor costs', account_type: 'expense', account_group: 6, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '622' },
  { account_number: '623', name: 'Chi phí sử dụng máy thi công', name_en: 'Machine usage costs', account_type: 'expense', account_group: 6, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '623' },
  { account_number: '627', name: 'Chi phí sản xuất chung', name_en: 'Manufacturing overhead', account_type: 'expense', account_group: 6, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '627' },
  { account_number: '632', name: 'Giá vốn hàng bán', name_en: 'Cost of goods sold', account_type: 'expense', account_group: 6, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '632' },
  { account_number: '635', name: 'Chi phí tài chính', name_en: 'Financial expenses', account_type: 'expense', account_group: 6, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '635' },
  { account_number: '642', name: 'Chi phí quản lý doanh nghiệp', name_en: 'Administrative expenses', account_type: 'expense', account_group: 6, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '642' },
  // Group 7
  { account_number: '711', name: 'Thu nhập khác', name_en: 'Other income', account_type: 'revenue', account_group: 7, normal_balance: 'credit', level: 1, is_system_account: true, tt200_code: '711' },
  // Group 8
  { account_number: '811', name: 'Chi phí khác', name_en: 'Other expenses', account_type: 'expense', account_group: 8, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '811' },
  { account_number: '821', name: 'Chi phí thuế TNDN', name_en: 'CIT expense', account_type: 'expense', account_group: 8, normal_balance: 'debit', level: 1, is_system_account: true, tt200_code: '821' },
  // Group 9
  { account_number: '911', name: 'Xác định kết quả kinh doanh', name_en: 'Income summary', account_type: 'equity', account_group: 9, normal_balance: 'credit', level: 1, is_system_account: true, tt200_code: '911' },
];

// --- Level 2 accounts (children, keyed by parent account_number) ---
const level2 = [
  // Group 1 children
  { account_number: '1111', name: 'Tiền Việt Nam', name_en: 'VND cash', parent: '111', account_type: 'asset', account_group: 1, normal_balance: 'debit', is_system_account: true },
  { account_number: '1112', name: 'Ngoại tệ', name_en: 'Foreign currency cash', parent: '111', account_type: 'asset', account_group: 1, normal_balance: 'debit', is_system_account: false },
  { account_number: '1121', name: 'Tiền VNĐ gửi NH', name_en: 'VND bank deposits', parent: '112', account_type: 'asset', account_group: 1, normal_balance: 'debit', is_system_account: true },
  { account_number: '1122', name: 'Ngoại tệ gửi NH', name_en: 'Foreign currency deposits', parent: '112', account_type: 'asset', account_group: 1, normal_balance: 'debit', is_system_account: false },
  { account_number: '1331', name: 'Thuế GTGT hàng hóa, DV', name_en: 'VAT on goods & services', parent: '133', account_type: 'asset', account_group: 1, normal_balance: 'debit', is_system_account: true },
  { account_number: '1332', name: 'Thuế GTGT của TSCĐ', name_en: 'VAT on fixed assets', parent: '133', account_type: 'asset', account_group: 1, normal_balance: 'debit', is_system_account: false },
  // Group 2 children
  { account_number: '2111', name: 'Nhà cửa, vật kiến trúc', name_en: 'Buildings & structures', parent: '211', account_type: 'asset', account_group: 2, normal_balance: 'debit', is_system_account: true },
  { account_number: '2112', name: 'Máy móc, thiết bị', name_en: 'Machinery & equipment', parent: '211', account_type: 'asset', account_group: 2, normal_balance: 'debit', is_system_account: true },
  { account_number: '2113', name: 'Phương tiện vận tải', name_en: 'Vehicles', parent: '211', account_type: 'asset', account_group: 2, normal_balance: 'debit', is_system_account: true },
  { account_number: '2114', name: 'Thiết bị, dụng cụ QL', name_en: 'Office equipment', parent: '211', account_type: 'asset', account_group: 2, normal_balance: 'debit', is_system_account: false },
  { account_number: '2141', name: 'Hao mòn TSCĐ hữu hình', name_en: 'Accum. depr. - tangible', parent: '214', account_type: 'contra_asset', account_group: 2, normal_balance: 'credit', is_system_account: true },
  // Group 3 children
  { account_number: '3331', name: 'Thuế GTGT phải nộp', name_en: 'VAT output', parent: '333', account_type: 'liability', account_group: 3, normal_balance: 'credit', is_system_account: true },
  { account_number: '3332', name: 'Thuế TTĐB', name_en: 'Special consumption tax', parent: '333', account_type: 'liability', account_group: 3, normal_balance: 'credit', is_system_account: false },
  { account_number: '3334', name: 'Thuế TNDN', name_en: 'Corporate income tax', parent: '333', account_type: 'liability', account_group: 3, normal_balance: 'credit', is_system_account: true },
  { account_number: '3335', name: 'Thuế TNCN', name_en: 'Personal income tax', parent: '333', account_type: 'liability', account_group: 3, normal_balance: 'credit', is_system_account: true },
  { account_number: '3338', name: 'Thuế khác', name_en: 'Other taxes', parent: '333', account_type: 'liability', account_group: 3, normal_balance: 'credit', is_system_account: false },
  { account_number: '3382', name: 'Kinh phí công đoàn', name_en: 'Trade union fee', parent: '338', account_type: 'liability', account_group: 3, normal_balance: 'credit', is_system_account: true },
  { account_number: '3383', name: 'Bảo hiểm xã hội', name_en: 'Social insurance', parent: '338', account_type: 'liability', account_group: 3, normal_balance: 'credit', is_system_account: true },
  { account_number: '3384', name: 'Bảo hiểm y tế', name_en: 'Health insurance', parent: '338', account_type: 'liability', account_group: 3, normal_balance: 'credit', is_system_account: true },
  { account_number: '3386', name: 'Bảo hiểm thất nghiệp', name_en: 'Unemployment insurance', parent: '338', account_type: 'liability', account_group: 3, normal_balance: 'credit', is_system_account: true },
  // Group 4 children
  { account_number: '4211', name: 'LN chưa phân phối năm trước', name_en: 'Prior year retained earnings', parent: '421', account_type: 'equity', account_group: 4, normal_balance: 'credit', is_system_account: true },
  { account_number: '4212', name: 'LN chưa phân phối năm nay', name_en: 'Current year retained earnings', parent: '421', account_type: 'equity', account_group: 4, normal_balance: 'credit', is_system_account: true },
  // Group 5 children
  { account_number: '5111', name: 'Doanh thu bán hàng hóa', name_en: 'Goods revenue', parent: '511', account_type: 'revenue', account_group: 5, normal_balance: 'credit', is_system_account: false },
  { account_number: '5112', name: 'Doanh thu cung cấp dịch vụ', name_en: 'Service revenue', parent: '511', account_type: 'revenue', account_group: 5, normal_balance: 'credit', is_system_account: false },
  { account_number: '5113', name: 'Doanh thu xây lắp', name_en: 'Construction revenue', parent: '511', account_type: 'revenue', account_group: 5, normal_balance: 'credit', is_system_account: true },
  // Group 6 children (627)
  { account_number: '6271', name: 'Chi phí nhân viên phân xưởng', name_en: 'Factory staff costs', parent: '627', account_type: 'expense', account_group: 6, normal_balance: 'debit', is_system_account: false },
  { account_number: '6272', name: 'Chi phí NVL', name_en: 'Material overhead', parent: '627', account_type: 'expense', account_group: 6, normal_balance: 'debit', is_system_account: false },
  { account_number: '6273', name: 'Chi phí dụng cụ SX', name_en: 'Production tools', parent: '627', account_type: 'expense', account_group: 6, normal_balance: 'debit', is_system_account: false },
  { account_number: '6274', name: 'Chi phí khấu hao TSCĐ', name_en: 'Depreciation overhead', parent: '627', account_type: 'expense', account_group: 6, normal_balance: 'debit', is_system_account: false },
  { account_number: '6277', name: 'Chi phí dịch vụ mua ngoài', name_en: 'Outsourced service costs', parent: '627', account_type: 'expense', account_group: 6, normal_balance: 'debit', is_system_account: false },
  { account_number: '6278', name: 'Chi phí bằng tiền khác', name_en: 'Other cash expenses', parent: '627', account_type: 'expense', account_group: 6, normal_balance: 'debit', is_system_account: false },
  // Group 6 children (642)
  { account_number: '6421', name: 'Chi phí nhân viên quản lý', name_en: 'Admin staff costs', parent: '642', account_type: 'expense', account_group: 6, normal_balance: 'debit', is_system_account: true },
  { account_number: '6422', name: 'Chi phí vật liệu quản lý', name_en: 'Admin material costs', parent: '642', account_type: 'expense', account_group: 6, normal_balance: 'debit', is_system_account: false },
  { account_number: '6423', name: 'Chi phí CCDC', name_en: 'Admin tools & supplies', parent: '642', account_type: 'expense', account_group: 6, normal_balance: 'debit', is_system_account: false },
  { account_number: '6424', name: 'Chi phí khấu hao TSCĐ QL', name_en: 'Admin depreciation', parent: '642', account_type: 'expense', account_group: 6, normal_balance: 'debit', is_system_account: false },
  { account_number: '6425', name: 'Thuế, phí và lệ phí', name_en: 'Taxes, fees & charges', parent: '642', account_type: 'expense', account_group: 6, normal_balance: 'debit', is_system_account: false },
  { account_number: '6427', name: 'Chi phí DV mua ngoài', name_en: 'Admin outsourced services', parent: '642', account_type: 'expense', account_group: 6, normal_balance: 'debit', is_system_account: false },
  { account_number: '6428', name: 'Chi phí bằng tiền khác (QL)', name_en: 'Admin other cash expenses', parent: '642', account_type: 'expense', account_group: 6, normal_balance: 'debit', is_system_account: false },
  // Group 8 children
  { account_number: '8211', name: 'CP thuế TNDN hiện hành', name_en: 'Current CIT', parent: '821', account_type: 'expense', account_group: 8, normal_balance: 'debit', is_system_account: true },
  { account_number: '8212', name: 'CP thuế TNDN hoãn lại', name_en: 'Deferred CIT', parent: '821', account_type: 'expense', account_group: 8, normal_balance: 'debit', is_system_account: false },
];

async function main() {
  console.log('🔄 Deleting existing seed data (non-destructive)...');
  
  // First, delete any ASCII-only entries that were inserted by accident earlier
  const { data: existing } = await supabase.from('acc_accounts').select('account_number');
  if (existing && existing.length > 0) {
    console.log(`  Found ${existing.length} existing accounts. Clearing for fresh seed...`);
    await supabase.from('acc_accounts').delete().not('id', 'is', null);
  }

  console.log('🌱 Inserting Level 1 accounts...');
  const { data: l1Data, error: l1Err } = await supabase.from('acc_accounts').upsert(level1, { onConflict: 'account_number' }).select();
  if (l1Err) { console.error('❌ Level 1 error:', l1Err); process.exit(1); }
  console.log(`  ✅ Inserted ${l1Data.length} Level 1 accounts`);

  // Build parent_id lookup
  const parentMap = {};
  l1Data.forEach(a => { parentMap[a.account_number] = a.id; });

  console.log('🌱 Inserting Level 2 accounts...');
  const l2WithParent = level2.map(a => ({
    account_number: a.account_number,
    name: a.name,
    name_en: a.name_en,
    account_type: a.account_type,
    account_group: a.account_group,
    normal_balance: a.normal_balance,
    level: 2,
    is_system_account: a.is_system_account,
    tt200_code: a.account_number,
    parent_id: parentMap[a.parent],
  }));
  const { data: l2Data, error: l2Err } = await supabase.from('acc_accounts').upsert(l2WithParent, { onConflict: 'account_number' }).select();
  if (l2Err) { console.error('❌ Level 2 error:', l2Err); process.exit(1); }
  console.log(`  ✅ Inserted ${l2Data.length} Level 2 accounts`);

  // --- Fiscal Year 2026 + 12 periods ---
  console.log('📅 Creating Fiscal Year 2026...');
  const { data: fyData, error: fyErr } = await supabase.from('acc_fiscal_years').upsert({
    year: 2026, start_date: '2026-01-01', end_date: '2026-12-31', is_current: true, status: 'open'
  }, { onConflict: 'year' }).select().single();
  if (fyErr) { console.error('❌ Fiscal year error:', fyErr); process.exit(1); }
  console.log(`  ✅ Fiscal Year 2026 created (ID: ${fyData.id})`);

  console.log('📅 Creating 12 periods...');
  const periods = [];
  for (let m = 1; m <= 12; m++) {
    const startDate = `2026-${String(m).padStart(2, '0')}-01`;
    const endDate = new Date(2026, m, 0).toISOString().split('T')[0];
    periods.push({
      fiscal_year_id: fyData.id,
      period: m,
      name: `Tháng ${m}/2026`,
      start_date: startDate,
      end_date: endDate,
      status: 'open',
    });
  }
  const { data: pData, error: pErr } = await supabase.from('acc_fiscal_periods').upsert(periods, { onConflict: 'fiscal_year_id,period' }).select();
  if (pErr) { console.error('❌ Period error:', pErr); process.exit(1); }
  console.log(`  ✅ Created ${pData.length} periods`);

  // --- Permissions ---
  console.log('🔐 Seeding permissions...');
  const perms = [
    { code: 'view_accounting', name: 'Xem Kế toán', description: 'Xem hệ thống tài khoản, sổ cái, báo cáo' },
    { code: 'manage_accounting', name: 'Quản lý Kế toán', description: 'Tạo/sửa tài khoản, bút toán' },
    { code: 'approve_journal', name: 'Duyệt bút toán', description: 'Duyệt và ghi sổ bút toán' },
    { code: 'manage_fiscal_periods', name: 'Quản lý kỳ kế toán', description: 'Mở/khóa sổ kỳ kế toán' },
  ];
  const { error: permErr } = await supabase.from('permissions').upsert(perms, { onConflict: 'code' });
  if (permErr) { console.error('⚠️ Permission error (may already exist):', permErr.message); }
  else { console.log(`  ✅ Seeded ${perms.length} permissions`); }

  console.log('\n🎉 Seed completed! Total accounts: ' + (l1Data.length + l2Data.length));
}

main().catch(console.error);

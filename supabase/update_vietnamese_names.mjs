// Update Vietnamese account names with proper diacritics
// Uses Supabase REST API with fetch (Node 18+)

const SUPABASE_URL = 'https://laoadqoisidnbgaqjsbw.supabase.co';

// We'll read the anon key from .env
import { readFileSync } from 'fs';
const envContent = readFileSync('.env', 'utf8');
const anonKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
if (!anonKey) { console.error('No VITE_SUPABASE_ANON_KEY in .env'); process.exit(1); }

const updates = [
  // Level 1
  { account_number: '111', name: 'Tiền mặt' },
  { account_number: '112', name: 'Tiền gửi ngân hàng' },
  { account_number: '131', name: 'Phải thu của khách hàng' },
  { account_number: '133', name: 'Thuế GTGT được khấu trừ' },
  { account_number: '136', name: 'Phải thu nội bộ' },
  { account_number: '138', name: 'Phải thu khác' },
  { account_number: '141', name: 'Tạm ứng' },
  { account_number: '152', name: 'Nguyên liệu, vật liệu' },
  { account_number: '153', name: 'Công cụ, dụng cụ' },
  { account_number: '154', name: 'Chi phí SXKD dở dang' },
  { account_number: '155', name: 'Thành phẩm' },
  { account_number: '211', name: 'TSCĐ hữu hình' },
  { account_number: '214', name: 'Hao mòn TSCĐ' },
  { account_number: '242', name: 'Chi phí trả trước' },
  { account_number: '331', name: 'Phải trả cho người bán' },
  { account_number: '333', name: 'Thuế và các khoản phải nộp NN' },
  { account_number: '334', name: 'Phải trả người lao động' },
  { account_number: '335', name: 'Chi phí phải trả' },
  { account_number: '338', name: 'Phải trả, phải nộp khác' },
  { account_number: '341', name: 'Vay và nợ thuê tài chính' },
  { account_number: '411', name: 'Vốn đầu tư của chủ sở hữu' },
  { account_number: '421', name: 'Lợi nhuận sau thuế chưa phân phối' },
  { account_number: '511', name: 'Doanh thu bán hàng và CCDV' },
  { account_number: '515', name: 'Doanh thu hoạt động tài chính' },
  { account_number: '521', name: 'Các khoản giảm trừ doanh thu' },
  { account_number: '621', name: 'Chi phí NVL trực tiếp' },
  { account_number: '622', name: 'Chi phí nhân công trực tiếp' },
  { account_number: '623', name: 'Chi phí sử dụng máy thi công' },
  { account_number: '627', name: 'Chi phí sản xuất chung' },
  { account_number: '632', name: 'Giá vốn hàng bán' },
  { account_number: '635', name: 'Chi phí tài chính' },
  { account_number: '642', name: 'Chi phí quản lý doanh nghiệp' },
  { account_number: '711', name: 'Thu nhập khác' },
  { account_number: '811', name: 'Chi phí khác' },
  { account_number: '821', name: 'Chi phí thuế TNDN' },
  { account_number: '911', name: 'Xác định kết quả kinh doanh' },
];

// Period name updates 
const periodUpdates = [
  { period: 1, name: 'Tháng 1/2026' },
  { period: 2, name: 'Tháng 2/2026' },
  { period: 3, name: 'Tháng 3/2026' },
  { period: 4, name: 'Tháng 4/2026' },
  { period: 5, name: 'Tháng 5/2026' },
  { period: 6, name: 'Tháng 6/2026' },
  { period: 7, name: 'Tháng 7/2026' },
  { period: 8, name: 'Tháng 8/2026' },
  { period: 9, name: 'Tháng 9/2026' },
  { period: 10, name: 'Tháng 10/2026' },
  { period: 11, name: 'Tháng 11/2026' },
  { period: 12, name: 'Tháng 12/2026' },
];

async function updateAccount(acc) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/acc_accounts?account_number=eq.${acc.account_number}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ name: acc.name })
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    console.error(`  ❌ ${acc.account_number}: ${txt}`);
    return false;
  }
  return true;
}

async function updatePeriod(p) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/acc_fiscal_periods?period=eq.${p.period}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ name: p.name })
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    console.error(`  ❌ Period ${p.period}: ${txt}`);
    return false;
  }
  return true;
}

async function main() {
  console.log('🔄 Updating 36 account names with Vietnamese diacritics...');
  let ok = 0;
  for (const acc of updates) {
    const success = await updateAccount(acc);
    if (success) ok++;
  }
  console.log(`  ✅ Updated ${ok}/${updates.length} accounts`);

  console.log('🔄 Updating 12 period names...');
  let pok = 0;
  for (const p of periodUpdates) {
    const success = await updatePeriod(p);
    if (success) pok++;
  }
  console.log(`  ✅ Updated ${pok}/${periodUpdates.length} periods`);

  console.log('🎉 Done!');
}

main().catch(console.error);

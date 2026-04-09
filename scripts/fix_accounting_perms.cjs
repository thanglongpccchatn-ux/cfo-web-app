const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: 'aws-1-ap-northeast-2.pooler.supabase.com',
    port: 6543,
    user: 'postgres.laoadqoisidnbgaqjsbw',
    password: 'Minh.son0411',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000
  });

  await client.connect();
  console.log('Connected!');

  // 1. Chuẩn hóa tất cả module name về "Kế toán"
  const r1 = await client.query(`
    UPDATE permissions 
    SET module = 'Kế toán',
        name = CASE code
          WHEN 'view_accounting' THEN 'Xem Kế toán'
          WHEN 'manage_accounting' THEN 'Quản lý Hệ thống TK'
          WHEN 'manage_fiscal_periods' THEN 'Quản lý Kỳ kế toán'
          WHEN 'create_journal' THEN 'Tạo & Sửa Bút toán'
          WHEN 'approve_journal' THEN 'Duyệt Bút toán'
          WHEN 'post_journal' THEN 'Ghi sổ Bút toán'
          ELSE name
        END,
        description = CASE code
          WHEN 'view_accounting' THEN 'Quyền xem các phân hệ kế toán: Hệ thống TK, Sổ Cái, Báo cáo TC'
          WHEN 'manage_accounting' THEN 'Quyền thêm/sửa/xóa tài khoản kế toán trong Hệ thống TK (CoA)'
          WHEN 'manage_fiscal_periods' THEN 'Quyền mở/đóng/khóa kỳ kế toán theo tháng và năm tài chính'
          WHEN 'create_journal' THEN 'Quyền tạo bút toán kép mới, sửa bút toán nháp, và gửi duyệt'
          WHEN 'approve_journal' THEN 'Quyền duyệt (post) hoặc từ chối bút toán kế toán'
          WHEN 'post_journal' THEN 'Quyền duyệt và ghi sổ bút toán vào sổ cái'
          ELSE description
        END
    WHERE code IN (
      'view_accounting', 'manage_accounting', 'manage_fiscal_periods', 
      'create_journal', 'approve_journal', 'post_journal',
      'view_financial_reports', 'manage_einvoice', 'manage_budget', 'manage_recurring'
    )
  `);
  console.log('Updated module names:', r1.rowCount, 'rows');

  // 2. Gán tất cả quyền kế toán cho ROLE01 (Admin)
  const r2 = await client.query(`
    INSERT INTO role_permissions (role_code, permission_code)
    SELECT 'ROLE01', code FROM permissions WHERE module = 'Kế toán'
    ON CONFLICT DO NOTHING
  `);
  console.log('ROLE01 assigned:', r2.rowCount, 'new');

  // 3. Gán tất cả quyền kế toán cho KETOAN
  const r3 = await client.query(`
    INSERT INTO role_permissions (role_code, permission_code)
    SELECT 'KETOAN', code FROM permissions WHERE module = 'Kế toán'
    ON CONFLICT DO NOTHING
  `);
  console.log('KETOAN assigned:', r3.rowCount, 'new');

  // 4. Verify
  const verify = await client.query(`
    SELECT code, name, module FROM permissions WHERE module = 'Kế toán' ORDER BY code
  `);
  console.log('\n=== FINAL STATE ===');
  verify.rows.forEach(r => console.log(`  ${r.code.padEnd(25)} ${r.name.padEnd(30)} [${r.module}]`));

  await client.end();
  console.log('\nDone!');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });

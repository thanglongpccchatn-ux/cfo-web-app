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

  // Check all accounting-related permissions
  const r = await client.query(`
    SELECT code, name, module 
    FROM permissions 
    WHERE module ILIKE '%ccounting%' 
       OR module = 'Kế toán'
       OR code ILIKE '%journal%' 
       OR code ILIKE '%accounting%'
       OR code ILIKE '%fiscal%'
       OR code ILIKE '%budget%'
       OR code ILIKE '%einvoice%'
       OR code ILIKE '%recurring%'
    ORDER BY module, code
  `);
  console.log('\n=== ACCOUNTING PERMISSIONS ===');
  console.log(JSON.stringify(r.rows, null, 2));

  // Check role_permissions for ROLE01 accounting
  const rp = await client.query(`
    SELECT rp.role_code, rp.permission_code 
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_code = p.code
    WHERE (p.module ILIKE '%ccounting%' OR p.module = 'Kế toán')
    ORDER BY rp.role_code, rp.permission_code
  `);
  console.log('\n=== ROLE ASSIGNMENTS ===');
  console.log(JSON.stringify(rp.rows, null, 2));

  await client.end();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });

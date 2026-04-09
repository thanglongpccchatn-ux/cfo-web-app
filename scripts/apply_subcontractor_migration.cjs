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

    try {
      await client.connect();
      console.log('Connected to Supabase Postgres!');
      
      const sql = `
-- 1. DROP NOT NULL constraint for partner_id and project_id to allow unresolved imports
ALTER TABLE subcontractor_contracts ALTER COLUMN partner_id DROP NOT NULL;
ALTER TABLE subcontractor_contracts ALTER COLUMN project_id DROP NOT NULL;

-- 2. Add columns to store the raw strings from the Excel file if they don't match our database
ALTER TABLE subcontractor_contracts ADD COLUMN IF NOT EXISTS unresolved_project TEXT;
ALTER TABLE subcontractor_contracts ADD COLUMN IF NOT EXISTS unresolved_partner TEXT;
      `;
      
      await client.query(sql);
      console.log('Migration executed successfully!');
      await client.end();
    } catch(e) {
      console.error('Error:', e.message);
      process.exit(1);
    }
}

run();

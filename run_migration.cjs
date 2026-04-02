const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const supabase = createClient(
  'https://laoadqoisidnbgaqjsbw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxhb2FkcW9pc2lkbmJnYXFqc2J3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTI5MTkxMCwiZXhwIjoyMDUwODY3OTEwfQ.gFHBHm2XNBFfWwqCZVBiDCi_PfIbOhp_0jPBmvKMTMY'
);

async function run() {
  console.log('Trying pg direct...');
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
    console.log('Connected!');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_expense_plans (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        week_number INTEGER NOT NULL,
        year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
        expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
        project_id UUID REFERENCES projects(id),
        cht_name TEXT,
        category TEXT NOT NULL DEFAULT 'Vật tư',
        description TEXT,
        priority TEXT DEFAULT 'Bình thường',
        requested_amount NUMERIC DEFAULT 0,
        actual_amount NUMERIC DEFAULT 0,
        planned_payment_date DATE,
        actual_payment_date DATE,
        status TEXT DEFAULT 'Chờ duyệt',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('Table created!');
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_weekly_plans_week ON weekly_expense_plans(year, week_number)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_weekly_plans_project ON weekly_expense_plans(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_weekly_plans_status ON weekly_expense_plans(status)`);
    console.log('Indexes created!');
    
    await client.query(`ALTER TABLE weekly_expense_plans ENABLE ROW LEVEL SECURITY`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='weekly_expense_plans' AND policyname='Allow all for authenticated') THEN
          CREATE POLICY "Allow all for authenticated" ON weekly_expense_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
        END IF;
      END $$
    `);
    console.log('RLS + Policy done!');
    
    await client.end();
    console.log('ALL DONE!');
  } catch (e) {
    console.error('Error:', e.message);
    await client.end();
  }
}

run();

import fs from 'fs';
import pg from 'pg';
const { Client } = pg;

const sqlFilePath = 'e:/AG/cfo-web-app/migration_inventory_update.sql';
const sql = fs.readFileSync(sqlFilePath, 'utf8');

const regions = [
    'aws-0-ap-southeast-1', // Singapore
    'aws-0-ap-northeast-1', // Tokyo
    'aws-0-us-east-1',      // N. Virginia
    'aws-0-us-west-1',      // N. California
    'aws-0-eu-central-1',   // Frankfurt
    'aws-0-ap-southeast-2', // Sydney
    'aws-0-eu-west-1',      // Ireland
    'aws-0-eu-west-2',      // London
    'aws-0-ap-northeast-2', // Seoul
    'aws-0-ap-south-1',     // Mumbai
    'aws-0-sa-east-1',      // Sao Paulo
    'aws-0-ca-central-1'    // Canada
];

async function tryRegion(region) {
    const connectionString = `postgresql://postgres.laoadqoisidnbgaqjsbw:Minh.kiet2405@${region}.pooler.supabase.com:6543/postgres`;
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log(`\n🎉 SUCCESS! Connected to region: ${region}`);
        console.log("Executing SQL...");
        await client.query(sql);
        console.log("✅ SQL migration executed successfully on remote database!");
        await client.end();
        return true;
    } catch (err) {
        if (err.message.includes('Tenant or user not found')) {
            // Expected if region is wrong
            process.stdout.write('.');
        } else if (err.message.includes('password authentication failed')) {
            console.log(`\n❌ Auth failed for ${region}. The password might be wrong.`);
            await client.end();
            return true; // Stop here, password is wrong
        } else {
            // Other error
            console.error(`\n❌ Error executing SQL on ${region}:`, err);
        }
        await client.end();
        return false;
    }
}

async function run() {
    console.log("Scanning Supabase regions to find the project host...");
    for (const r of regions) {
        const found = await tryRegion(r);
        if (found) return;
    }
    console.log("\n❌ Could not connect or execute the database script.");
}

run();

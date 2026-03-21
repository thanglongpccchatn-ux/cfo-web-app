import pg from 'pg';
const { Client } = pg;

const sql = `
-- Thêm cột account_holder và bank_branch vào bảng partners nếu chưa có
ALTER TABLE public.partners 
ADD COLUMN IF NOT EXISTS account_holder TEXT,
ADD COLUMN IF NOT EXISTS bank_branch TEXT;

-- Yêu cầu Supabase tải lại schema cache để nhận diện cột mới ngay lập tức
NOTIFY pgrst, 'reload schema';
`;

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
        console.log(`\n🎉 Bắt đầu kết nối tới Database khu vực: ${region}`);
        console.log("Đang chạy lệnh tạo cột 'account_holder' và 'bank_branch'...");
        await client.query(sql);
        console.log("✅ Đã tạo thành công 2 cột mới trong CSDL!");
        await client.end();
        return true;
    } catch (err) {
        if (err.message.includes('Tenant or user not found')) {
            process.stdout.write('.');
        } else if (err.message.includes('password authentication failed')) {
            console.log(`\n❌ Sai mật khẩu kết nối Database ở ${region}.`);
            await client.end();
            return true;
        } else {
            console.log("Lỗi:", err.message);
            process.stdout.write('x');
        }
        await client.end();
        return false;
    }
}

async function run() {
    console.log("Đang dò tìm máy chủ cơ sở dữ liệu của bạn...");
    for (const r of regions) {
        const found = await tryRegion(r);
        if (found) return;
    }
    console.log("\n❌ Không thể kết nối tới Database. Vui lòng thêm thủ công trên trang chủ Supabase.");
}

run();

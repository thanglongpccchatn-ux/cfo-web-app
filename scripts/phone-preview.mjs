// Mở cửa sổ Chromium giả lập iPhone 13 NGAY TRÊN PC để test bằng tay.
// Dùng: node scripts/phone-preview.mjs [đường-dẫn]   (mặc định /)
// Đóng cửa sổ trình duyệt là script tự thoát.
import { chromium, devices } from 'playwright';

const route = process.argv[2] || '/';
const BASE = process.env.SHOT_BASE || 'http://localhost:5173';
const iphone = devices['iPhone 13'];

const browser = await chromium.launch({
    headless: false,
    args: [`--window-size=${iphone.viewport.width + 20},${iphone.viewport.height + 120}`],
});
const ctx = await browser.newContext({
    ...iphone,
    // Bỏ khóa viewport cứng để cửa sổ co giãn tự nhiên theo khung
});
const page = await ctx.newPage();
await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
console.log('Đã mở khung iPhone 13 —', BASE + route);
console.log('Cứ bấm thử thoải mái. Đóng cửa sổ trình duyệt để thoát.');

await page.waitForEvent('close', { timeout: 0 }).catch(() => {});
await browser.close().catch(() => {});

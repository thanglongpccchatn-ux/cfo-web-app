// Công cụ dev: chụp màn hình app ở khung điện thoại (iPhone 13) — light + dark.
// Dùng: node scripts/screenshot-mobile.mjs [đường-dẫn] [thư-mục-ảnh-ra]
//   VD: node scripts/screenshot-mobile.mjs /dashboard ./shots
// Yêu cầu: dev server đang chạy (npm run dev) tại localhost:5173.
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const route = process.argv[2] || '/';
const outDir = process.argv[3] || './shots';
const BASE = process.env.SHOT_BASE || 'http://localhost:5173';

mkdirSync(outDir, { recursive: true });
const slug = route.replaceAll('/', '_') || '_root';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();

for (const theme of ['light', 'dark']) {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
    await page.evaluate(t => localStorage.setItem('ui_theme', t), theme);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const path = `${outDir}/${slug}-${theme}.png`;
    await page.screenshot({ path, fullPage: false });
    console.log('Đã chụp:', path);
}

console.log('URL cuối:', page.url());
await browser.close();

# Trợ lý AI theo vai trò — Hướng dẫn triển khai

AI trong app gọi **Google Gemini** qua một **Supabase Edge Function**. Chưa làm 3 bước
dưới đây thì khung chat vẫn hiện nhưng báo lỗi "chưa triển khai Edge Function".

## Vì sao phải qua Edge Function (không gọi thẳng từ web)

App là SPA thuần — **mọi thứ trong bundle JS đều công khai**, ai mở DevTools cũng đọc được.
Nếu để API key của Gemini trong `.env` phía client thì bất kỳ ai vào web cũng lấy được key
và tiêu tiền của công ty. Key chỉ được đặt trong secrets của Supabase.

## Ranh giới dữ liệu theo vai trò

Đây là điểm quan trọng nhất, và nó **không dựa vào prompt**:

- Edge Function tạo Supabase client mang **JWT của chính người đang hỏi** (không dùng
  `service_role`), nên mọi truy vấn của AI đều bị **RLS** chặn y như người đó tự truy vấn.
- Bộ công cụ (`tools.ts`) lọc theo **quyền thực tế** của người dùng: ai không có
  `view_materials` thì công cụ tra giá vật tư **không được nạp**.
- AI **không được viết SQL tự do** — chỉ gọi các công cụ định sẵn với tham số ràng buộc kiểu.

Kết quả: nhân viên kho hỏi "lợi nhuận dự án X bao nhiêu?" sẽ không nhận được số, kể cả khi
model cố gọi công cụ.

---

## Bước 1 — Chạy SQL tạo bảng nhật ký

Mở Supabase SQL Editor, chạy [`db/ai_usage.sql`](../db/ai_usage.sql).

Bảng `ai_usage` phục vụ: giới hạn **50 lượt/người/ngày** và lưu vết ai hỏi gì.
RLS đã đặt: mỗi người chỉ đọc được nhật ký của chính mình (câu hỏi có thể chứa thông tin nhạy cảm).

## Bước 2 — Đặt API key của Gemini

Lấy key MIỄN PHÍ tại <https://aistudio.google.com/apikey> → *Get API key* (không cần thẻ).

```bash
npm i -g supabase          # nếu chưa có Supabase CLI
supabase login
supabase link --project-ref laoadqoisidnbgaqjsbw
supabase secrets set GEMINI_API_KEY=AIza...
```

> Key **chỉ** nằm ở đây. Không đưa vào `.env`, không commit vào git.

## Bước 3 — Deploy Edge Function

```bash
supabase functions deploy ai-assistant
```

Kiểm tra nhanh:

```bash
supabase functions logs ai-assistant
```

Sau đó vào app, bấm nút tím góc dưới bên phải và hỏi thử:
*"Còn bao nhiêu đề nghị thanh toán chờ duyệt?"*

---

## Cấu trúc mã nguồn

| Tệp | Vai trò |
|---|---|
| `supabase/functions/ai-assistant/index.ts` | Handler: xác thực, rate limit, vòng lặp gọi công cụ (Gemini function calling) |
| `supabase/functions/ai-assistant/tools.ts` | Bộ công cụ đọc dữ liệu + lọc theo quyền |
| `supabase/functions/ai-assistant/roles.ts` | System prompt riêng cho 11 vai trò |
| `src/lib/aiAssistant.js` | Client gọi Edge Function |
| `src/components/ai/AIAssistantPanel.jsx` | Khung chat (nút nổi) |
| `src/components/ai/AIRoleInsights.jsx` | Nhận định theo vai trò trên dashboard |
| `db/ai_usage.sql` | Bảng nhật ký + RLS |

## Chi phí và cách kiểm soát

- Mặc định model `gemini-2.5-flash` (có gói miễn phí rộng), `maxOutputTokens` 1500, tối đa 5 vòng gọi công cụ mỗi câu.
- Giới hạn **50 lượt/người/ngày** (sửa `DAILY_LIMIT` trong `index.ts`).
- Nhận định trên dashboard **không tự chạy** khi mở trang — phải bấm nút, tránh đốt tiền
  mỗi lần ai đó mở dashboard.
- Theo dõi lượng dùng:

```sql
select role_code, count(*) as so_luot, max(created_at) as lan_cuoi
from public.ai_usage
where created_at > now() - interval '7 days'
group by role_code order by so_luot desc;
```

## Muốn thêm công cụ mới cho AI

Thêm một mục vào mảng `TOOLS` trong `tools.ts`:

```ts
{
  name: 'ten_cong_cu',
  description: 'Mô tả rõ khi nào dùng — model dựa vào đây để quyết định gọi.',
  perms: ['view_xxx'],              // rỗng = mọi người đăng nhập đều dùng được
  input_schema: { type: 'object', properties: { ... } },
  run: async (args, db) => { /* db đã mang JWT người dùng, RLS tự chặn */ },
}
```

Không cần sửa gì khác — công cụ tự được nạp cho đúng người có quyền.

## Giới hạn hiện tại

- **Chưa có hành động ghi.** Theo thiết kế đã chốt, AI sẽ chỉ *soạn sẵn* thao tác và người
  dùng bấm xác nhận mới chạy — phần này **chưa làm**, hiện AI chỉ đọc.
- Chưa có streaming (câu trả lời hiện một lần khi xong).
- Lịch sử hội thoại chỉ nằm trong phiên, đóng panel là mất.

/**
 * EDGE FUNCTION: ai-assistant
 * Proxy gọi Google Gemini cho ứng dụng CFO. Chạy trên Supabase (Deno).
 *
 * VÌ SAO PHẢI CÓ LỚP NÀY: app là SPA thuần — mọi thứ trong bundle JS đều công khai.
 * Gọi thẳng model từ trình duyệt là lộ API key cho mọi người dùng. Key chỉ nằm ở
 * đây, trong secrets của Supabase.
 *
 * RANH GIỚI DỮ LIỆU THEO ROLE (điểm cốt lõi):
 *   Ta tạo Supabase client MANG JWT CỦA NGƯỜI DÙNG (không dùng service_role), nên mọi
 *   truy vấn của AI đều bị RLS chặn đúng như chính người đó tự truy vấn. Nhân viên kho
 *   hỏi về lợi nhuận sẽ không nhận được dữ liệu, kể cả khi model cố gọi công cụ.
 *
 * TRIỂN KHAI:
 *   supabase secrets set GEMINI_API_KEY=...      (lấy free tại aistudio.google.com/apikey)
 *   supabase functions deploy ai-assistant
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { toolsForUser, toGeminiTools } from './tools.ts';
import { systemPromptFor } from './roles.ts';

const MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_TOOL_ROUNDS = 5;          // chặn vòng lặp gọi công cụ vô tận
const DAILY_LIMIT = 50;             // số câu hỏi/người/ngày

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Chỉ hỗ trợ POST' }, 405);

    // Nhận cả tên cũ ANTHROPIC_API_KEY để không vỡ nếu ai đó đã set trước đó
    const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) return json({ error: 'Chưa cấu hình GEMINI_API_KEY trên Supabase (lấy key free tại aistudio.google.com/apikey)' }, 500);

    // 1) Xác thực: bắt buộc có JWT của người dùng
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Chưa đăng nhập' }, 401);

    // 2) Client MANG JWT NGƯỜI DÙNG -> mọi truy vấn tuân RLS (KHÔNG dùng service_role)
    const db = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await db.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Phiên đăng nhập không hợp lệ' }, 401);
    const user = userData.user;

    // 3) Lấy vai trò + quyền thực tế của người dùng
    const { data: profile } = await db
        .from('profiles')
        .select('full_name, role_code, roles(name)')
        .eq('id', user.id)
        .maybeSingle();

    const roleCode = profile?.role_code || '';
    const isAdmin = roleCode === 'ROLE01' || roleCode === 'ADMIN';

    const { data: permRows } = await db
        .from('role_permissions')
        .select('permission_code')
        .eq('role_code', roleCode);
    const perms: string[] = (permRows || []).map((r: any) => r.permission_code);

    // 4) Giới hạn dùng/ngày để không bị lạm dụng
    const today = new Date().toISOString().slice(0, 10);
    const { count: usedToday } = await db
        .from('ai_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', `${today}T00:00:00Z`);
    if ((usedToday || 0) >= DAILY_LIMIT) {
        return json({ error: `Bạn đã dùng hết ${DAILY_LIMIT} lượt hỏi AI hôm nay. Thử lại vào ngày mai.` }, 429);
    }

    // 5) Đọc yêu cầu
    let body: any;
    try { body = await req.json(); } catch { return json({ error: 'Body không hợp lệ' }, 400); }
    const messages = Array.isArray(body?.messages) ? body.messages : null;
    if (!messages?.length) return json({ error: 'Thiếu nội dung câu hỏi' }, 400);

    // 6) Bộ công cụ theo quyền + persona theo vai trò
    const allowed = toolsForUser(perms, isAdmin);
    const system = systemPromptFor(roleCode, (profile as any)?.roles?.name || null, profile?.full_name || null);

    // 7) Hội thoại dạng Gemini: role 'user' | 'model', nội dung trong parts[]
    const contents: any[] = messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content ?? '') }],
    }));

    const toolTrace: string[] = [];
    let finalText = '';

    try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: system }] },
                    contents,
                    tools: allowed.length ? [{ functionDeclarations: toGeminiTools(allowed) }] : undefined,
                    generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
                }),
            });

            if (!res.ok) {
                // Trả THÔNG BÁO THẬT của Gemini thay vì chỉ mã số — không có nó thì
                // người dùng chỉ thấy "(400)" và không biết phải sửa gì.
                const raw = await res.text();
                let msg = raw.slice(0, 300);
                try { msg = JSON.parse(raw)?.error?.message || msg; } catch { /* giữ raw */ }

                const friendly =
                    /API key not valid|API_KEY_INVALID|invalid.*key/i.test(msg)
                        ? 'API key của Gemini không hợp lệ. Lấy key mới tại aistudio.google.com/apikey rồi cập nhật GEMINI_API_KEY trong Supabase.'
                    : /quota|RESOURCE_EXHAUSTED|rate/i.test(msg)
                        ? 'Đã chạm giới hạn miễn phí của Gemini, thử lại sau ít phút.'
                    : /model/i.test(msg)
                        ? `Model không dùng được: ${msg}`
                    : `Lỗi từ Gemini (${res.status}): ${msg}`;

                return json({ error: friendly, detail: msg }, 502);
            }

            const data = await res.json();
            const parts = data?.candidates?.[0]?.content?.parts || [];
            const calls = parts.filter((p: any) => p.functionCall);
            const textNow = parts.filter((p: any) => p.text).map((p: any) => p.text).join('\n').trim();
            if (textNow) finalText = textNow;

            if (calls.length === 0) break;

            // Lưu lượt của model rồi thực thi công cụ — chạy bằng JWT người dùng nên RLS vẫn chặn
            contents.push({ role: 'model', parts });
            const responseParts: any[] = [];
            for (const p of calls) {
                const name = p.functionCall?.name;
                const args = p.functionCall?.args || {};
                toolTrace.push(name);
                const def = allowed.find(t => t.name === name);
                if (!def) {
                    responseParts.push({ functionResponse: { name, response: { error: 'Bạn không có quyền dùng công cụ này.' } } });
                    continue;
                }
                try {
                    const out = await def.run(args, db);
                    responseParts.push({
                        functionResponse: {
                            name,
                            response: { result: JSON.parse(JSON.stringify(out ?? []).slice(0, 20000)) },
                        },
                    });
                } catch (e) {
                    responseParts.push({ functionResponse: { name, response: { error: `Lỗi truy vấn: ${(e as Error).message}` } } });
                }
            }
            contents.push({ role: 'user', parts: responseParts });
        }
    } catch (e) {
        return json({ error: 'Lỗi xử lý: ' + (e as Error).message }, 500);
    }

    // 8) Ghi nhật ký dùng AI (rate limit + audit). Lỗi ghi log không được chặn câu trả lời.
    try {
        await db.from('ai_usage').insert({
            user_id: user.id,
            role_code: roleCode,
            question: String(messages[messages.length - 1]?.content ?? '').slice(0, 1000),
            tools_used: toolTrace,
        });
    } catch { /* bỏ qua */ }

    return json({
        answer: finalText || 'Tôi chưa tìm được dữ liệu phù hợp cho câu hỏi này.',
        tools_used: toolTrace,
        role_code: roleCode,
        remaining_today: Math.max(0, DAILY_LIMIT - (usedToday || 0) - 1),
    });
});

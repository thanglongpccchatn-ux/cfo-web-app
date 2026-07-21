import { supabase } from './supabase';

/**
 * Gọi Edge Function `ai-assistant`.
 * Key của Claude nằm ở phía Supabase — client KHÔNG bao giờ chạm vào.
 * JWT người dùng được gửi kèm để AI chỉ đọc được dữ liệu trong quyền của họ (RLS).
 *
 * @param {Array<{role:'user'|'assistant', content:string}>} messages
 * @returns {Promise<{ok:boolean, answer?:string, toolsUsed?:string[], remaining?:number, error?:string}>}
 */
export async function askAI(messages) {
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return { ok: false, error: 'Bạn cần đăng nhập lại để dùng trợ lý AI.' };

        const { data, error } = await supabase.functions.invoke('ai-assistant', {
            body: { messages },
            headers: { Authorization: `Bearer ${token}` },
        });

        if (error) {
            // Edge Function trả lỗi có nội dung -> đọc ra cho người dùng hiểu
            let detail = error.message || 'Không gọi được trợ lý AI';
            try {
                const ctx = await error.context?.json?.();
                if (ctx?.error) detail = ctx.error;
            } catch { /* giữ nguyên detail */ }
            if (/Failed to send|not found|404/i.test(detail)) {
                detail = 'Chưa triển khai Edge Function ai-assistant trên Supabase (xem docs/AI_SETUP.md).';
            }
            return { ok: false, error: detail };
        }

        if (data?.error) return { ok: false, error: data.error };
        return {
            ok: true,
            answer: data?.answer || '',
            toolsUsed: data?.tools_used || [],
            remaining: data?.remaining_today,
        };
    } catch (e) {
        return { ok: false, error: e?.message || 'Lỗi không xác định khi gọi AI' };
    }
}

/** Gợi ý câu hỏi mở đầu theo vai trò — đồng bộ với roles.ts phía Edge Function. */
export const AI_SUGGESTIONS = {
    ROLE01: ['Dự án nào đang nợ nhiều nhất?', 'Còn bao nhiêu đề nghị chờ duyệt?', 'Tổng quan dòng tiền năm nay'],
    ROLE02: ['Tóm tắt tình hình tài chính hiện tại', 'Rủi ro dòng tiền tháng tới?', 'Công nợ phải thu lớn nhất'],
    ROLE03: ['Vật tư nào tăng giá bất thường?', 'So sánh giá vật tư giữa các NCC', 'Tồn kho sắp hết'],
    ROLE04: ['Khối lượng nghiệm thu vs đã thanh toán', 'Đề nghị nào vượt khối lượng?'],
    ROLE05: ['Đề nghị nào đang chờ duyệt?', 'Tổ đội nào công nợ cao nhất?', 'Công nợ đến kỳ phải trả'],
    ROLE06: ['Hợp đồng nào chưa quyết toán?', 'Tiến độ hồ sơ thanh toán'],
    ROLE07: ['Chi phí dự án của tôi', 'Nhân công đã chi bao nhiêu?'],
    ROLE08: ['Khối lượng hạng mục của tôi', 'Vật tư cần cho công việc'],
    ROLE09: ['Tồn kho dự án hiện tại', 'Vật tư nào sắp hết?'],
    ROLE10: ['Tồn kho toàn công ty', 'Vật tư tồn lâu chưa dùng'],
    ROLE11: ['Tồn kho hôm nay', 'Vật tư dưới định mức'],
};

export const suggestionsFor = (roleCode) => AI_SUGGESTIONS[roleCode] || AI_SUGGESTIONS.ROLE01;

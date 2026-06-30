// Tìm kiếm vật tư đa từ khóa (AND) + xếp hạng liên quan — dùng chung cho
// ProductAutocomplete (nhập đơn mua hàng) và trang /materials.

/** Bỏ dấu tiếng Việt + đ→d, để so khớp không phụ thuộc dấu. */
export const removeDiacritics = (str) =>
    (str ?? '')
        .toString()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase();

/**
 * Lọc danh sách vật tư theo `query` rồi sắp xếp theo độ liên quan.
 * - Tách query thành nhiều token; MỌI token phải xuất hiện trong tên/mã/hãng/model (AND).
 * - Xếp hạng: khớp nguyên cụm ở đầu tên > trong tên > trong mã; vị trí sớm; trùng ở tên; tên gọn.
 * @param {Array<object>} materials danh sách vật tư
 * @param {string} query chuỗi tìm kiếm (có thể nhiều từ, có/không dấu)
 * @returns {Array<object>} danh sách đã lọc + sắp xếp (query rỗng → trả nguyên danh sách)
 */
export function searchMaterials(materials, query) {
    const raw = removeDiacritics(query).trim();
    if (!raw) return materials;
    const tokens = raw.split(/\s+/).filter(Boolean);
    const scored = [];
    for (const m of materials) {
        const name = removeDiacritics(m.name);
        const code = removeDiacritics(m.code);
        const hay = `${name} ${code} ${removeDiacritics(m.brand)} ${removeDiacritics(m.model)}`;
        if (!tokens.every((t) => hay.includes(t))) continue; // AND: mọi từ khóa đều phải có
        let score = 0;
        if (name.startsWith(raw)) score += 100;
        else if (name.includes(raw)) score += 60;
        else if (code.includes(raw)) score += 40;
        const pos = name.indexOf(tokens[0]);
        if (pos >= 0) score += Math.max(0, 25 - pos);
        score += tokens.filter((t) => name.includes(t)).length * 5; // ưu tiên trùng ở TÊN
        score -= name.length * 0.02; // tên gọn = sát hơn
        scored.push({ m, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.m);
}

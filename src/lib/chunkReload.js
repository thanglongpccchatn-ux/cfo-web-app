// Xử lý lỗi tải "chunk" cũ sau khi deploy (Vite + PWA):
// bản deploy mới đổi hash file .js nên URL chunk cũ (đang được index.html cũ tham chiếu)
// trả 404 -> dynamic import fail. Cách khắc phục chuẩn: tự reload 1 lần để nạp index.html
// mới (trỏ tới hash mới). Có cooldown để nếu reload xong vẫn lỗi thì dừng, hiện UI lỗi.

const RELOAD_KEY = 'chunkReloadAt';
const COOLDOWN = 10000; // ms

const CHUNK_ERR_RE = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch dynamically/i;

/** Có phải lỗi tải chunk/module động (thường do deploy mới đổi hash) không? */
export function isChunkLoadError(err) {
    const msg = (err && (err.message || String(err))) || '';
    return CHUNK_ERR_RE.test(msg);
}

/**
 * Reload 1 lần để nạp phiên bản mới. Trả true nếu đã kích hoạt reload,
 * false nếu vừa reload trong COOLDOWN (tránh vòng lặp vô hạn) -> để caller hiện UI lỗi.
 */
export function reloadForNewVersion() {
    try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last < COOLDOWN) return false;
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
        // sessionStorage có thể bị chặn (private mode) -> vẫn reload 1 phát
    }
    window.location.reload();
    return true;
}

/** Reload cưỡng bức (bỏ qua cooldown) — dùng cho nút bấm thủ công của người dùng. */
export function forceReload() {
    try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ }
    window.location.reload();
}

-- ============================================================
--  Fix review H8: chống BÚT TOÁN TỰ ĐỘNG TRÙNG (race check-then-insert)
--  accountingService.createAutoJournalEntry kiểm tra "đã tồn tại chưa" rồi mới insert
--  -> 2 lần gọi gần nhau (double-click / retry mạng) tạo 2 bút toán cho 1 nghiệp vụ.
--  Unique index ở DB là chốt chặn cuối; client bắt lỗi 23505 coi như đã tồn tại.
--
--  Chạy trong Supabase SQL Editor. Partial index: chỉ áp khi cả 2 cột không null
--  (bút toán thủ công không có source thì không bị ràng buộc).
--
--  LƯU Ý: nếu hiện đã có bản ghi trùng (source_module, source_id) thì lệnh tạo index
--  sẽ lỗi — cần dọn trùng trước. Câu kiểm tra trùng ở cuối file.
-- ============================================================

create unique index if not exists uq_acc_journal_source
    on public.acc_journal_entries (source_module, source_id)
    where source_module is not null and source_id is not null;

-- Kiểm tra có bản ghi trùng không (nếu tạo index lỗi, chạy câu này để tìm & dọn):
-- select source_module, source_id, count(*)
--   from public.acc_journal_entries
--  where source_module is not null and source_id is not null
--  group by source_module, source_id having count(*) > 1;

import { describe, it, expect } from 'vitest';
import { searchMaterials, removeDiacritics } from '../lib/materialSearch';

// Dữ liệu mẫu mô phỏng danh mục thật (PCCC Thăng Long)
const MATS = [
    { id: 1, name: 'Côn thu đồng tâm đen SCH20 DN100/32', code: 'CON-THU-DEN-DN100-32', brand: '', model: '' },
    { id: 2, name: 'Côn thu đồng tâm đen SCH20 DN100/65', code: 'CON-THU-DEN-DN100-65', brand: '', model: '' },
    { id: 3, name: 'Kép ren ngoài mạ kẽm DN32', code: 'KEP-REN-DN32', brand: '', model: '' },
    { id: 4, name: 'Ống thép mạ kẽm DN32 dày 2.3mm', code: 'ONG-KEM-DN32', brand: 'Hòa Phát', model: '' },
    { id: 5, name: 'Van bướm tay gạt DN100', code: 'VAN-BUOM-DN100', brand: 'Shin Yi', model: 'D71X' },
];

describe('removeDiacritics', () => {
    it('bỏ dấu tiếng Việt và đổi đ→d, về chữ thường', () => {
        expect(removeDiacritics('Côn thu Đồng tâm ĐEN')).toBe('con thu dong tam den');
    });
    it('an toàn với null/undefined/số', () => {
        expect(removeDiacritics(null)).toBe('');
        expect(removeDiacritics(undefined)).toBe('');
        expect(removeDiacritics(123)).toBe('123');
    });
});

describe('searchMaterials', () => {
    it('query rỗng → trả nguyên danh sách', () => {
        expect(searchMaterials(MATS, '')).toHaveLength(MATS.length);
        expect(searchMaterials(MATS, '   ')).toHaveLength(MATS.length);
    });

    it('match đa từ khóa AND — gõ từ rời rạc, không cần đúng thứ tự', () => {
        const r = searchMaterials(MATS, 'thu den 100');
        expect(r.map(m => m.id).sort()).toEqual([1, 2]); // chỉ 2 côn thu DN100
    });

    it('không dấu vẫn khớp tên có dấu', () => {
        const r = searchMaterials(MATS, 'con thu');
        expect(r.every(m => m.name.startsWith('Côn thu'))).toBe(true);
        expect(r).toHaveLength(2);
    });

    it('mọi token đều phải có (AND) — thiếu 1 token thì loại', () => {
        expect(searchMaterials(MATS, 'thu 999')).toHaveLength(0);
        expect(searchMaterials(MATS, 'kep ren xyz')).toHaveLength(0);
    });

    it('tìm được theo mã, hãng, model', () => {
        expect(searchMaterials(MATS, 'KEP-REN-DN32').map(m => m.id)).toContain(3);
        expect(searchMaterials(MATS, 'hoa phat').map(m => m.id)).toContain(4);
        expect(searchMaterials(MATS, 'd71x').map(m => m.id)).toContain(5);
    });

    it('xếp hạng: khớp đầu tên lên trước khớp giữa', () => {
        const mats = [
            { id: 'a', name: 'Ống thép mạ kẽm DN32', code: '', brand: '', model: '' },
            { id: 'b', name: 'Van DN32 ống nối', code: '', brand: '', model: '' },
            { id: 'c', name: 'Ống nhựa DN32', code: '', brand: '', model: '' },
        ];
        const r = searchMaterials(mats, 'ong');
        expect(r[0].id).not.toBe('b'); // 'ong' ở đầu tên (a/c) phải đứng trên 'b' (ở giữa)
    });

    it('xử lý field thiếu (null/undefined) không lỗi', () => {
        const mats = [{ id: 1, name: 'Test vật tư' }]; // thiếu code/brand/model
        expect(() => searchMaterials(mats, 'test')).not.toThrow();
        expect(searchMaterials(mats, 'test')).toHaveLength(1);
    });

    it('phân biệt DN100/32 vs DN100/65 (không gộp nhầm)', () => {
        expect(searchMaterials(MATS, 'thu 100 32').map(m => m.id)).toEqual([1]);
        expect(searchMaterials(MATS, 'thu 100 65').map(m => m.id)).toEqual([2]);
    });
});

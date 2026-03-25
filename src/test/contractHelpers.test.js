import { describe, it, expect } from 'vitest';
import { calculateAllocations, formatPrice, parseFormattedNumber, formatInputNumber, fmt, formatBillion } from '../components/contract/contractHelpers.ts';

describe('calculateAllocations', () => {
    it('tính đúng với giá trị tiêu chuẩn: 10 tỷ, VAT 8%, nội bộ 8%, tỷ lệ HĐ 98%, chiết khấu 2.5%', () => {
        const result = calculateAllocations(10_000_000_000, 8, 8, 98, 2.5);
        
        // Tỷ lệ thực tế
        expect(result.actualRatio).toBe(95.5);
        
        // Thăng Long 100%
        expect(result.tl_preVat).toBe(10_000_000_000);
        expect(result.tl_vatAmount).toBe(800_000_000);
        expect(result.tl_postVat).toBe(10_800_000_000);
        
        // Sateco HĐ (98%)
        expect(result.st_invoice_preVat).toBe(9_800_000_000);
        expect(result.st_invoice_vat).toBe(784_000_000);
        expect(result.st_invoice_postVat).toBe(10_584_000_000);
        
        // Sateco Thực nhận (95.5%)
        expect(result.st_actual_preVat).toBe(9_550_000_000);
        expect(result.st_actual_vat).toBe(764_000_000);
        expect(result.st_actual_postVat).toBe(10_314_000_000);
        
        // TL giữ lại
        expect(result.tl_cutPercent).toBe(2);
        expect(result.tl_cutAmount).toBe(200_000_000);
        
        // Chiết khấu nội bộ
        expect(result.internalCutAmount).toBe(250_000_000);
    });

    it('tính đúng khi không có chiết khấu nội bộ', () => {
        const result = calculateAllocations(5_000_000_000, 10, 10, 100, 0);
        
        expect(result.actualRatio).toBe(100);
        expect(result.tl_preVat).toBe(5_000_000_000);
        expect(result.tl_vatAmount).toBe(500_000_000);
        expect(result.st_invoice_preVat).toBe(5_000_000_000);
        expect(result.tl_cutPercent).toBe(0);
        expect(result.tl_cutAmount).toBe(0);
        expect(result.internalCutAmount).toBe(0);
    });

    it('tính đúng với giá trị nhỏ (dưới 1 triệu)', () => {
        const result = calculateAllocations(500_000, 8, 8, 98, 0);
        
        expect(result.tl_preVat).toBe(500_000);
        expect(result.tl_vatAmount).toBe(40_000);
        expect(result.st_invoice_preVat).toBe(490_000);
    });

    it('trả về 0 khi giá trị hợp đồng bằng 0', () => {
        const result = calculateAllocations(0, 8, 8, 98, 2.5);
        
        expect(result.tl_preVat).toBe(0);
        expect(result.tl_vatAmount).toBe(0);
        expect(result.tl_postVat).toBe(0);
        expect(result.st_invoice_preVat).toBe(0);
        expect(result.st_actual_preVat).toBe(0);
    });

    it('xử lý VAT 0%', () => {
        const result = calculateAllocations(1_000_000_000, 0, 0, 98, 0);
        
        expect(result.tl_vatAmount).toBe(0);
        expect(result.tl_postVat).toBe(1_000_000_000);
        expect(result.st_invoice_vat).toBe(0);
    });
});

describe('formatPrice', () => {
    it('format số tiền có đơn vị ₫', () => {
        expect(formatPrice(1500000)).toBe('1.500.000 ₫');
    });
    
    it('trả về "0 ₫" khi null/undefined', () => {
        expect(formatPrice(null)).toBe('0 ₫');
        expect(formatPrice(undefined)).toBe('0 ₫');
    });
});

describe('parseFormattedNumber', () => {
    it('parse chuỗi có dấu chấm ngăn cách', () => {
        expect(parseFormattedNumber('1.500.000')).toBe(1500000);
    });
    
    it('trả về 0 khi chuỗi rỗng hoặc null', () => {
        expect(parseFormattedNumber('')).toBe(0);
        expect(parseFormattedNumber(null)).toBe(0);
    });
});

describe('fmt', () => {
    it('format số theo kiểu Việt Nam', () => {
        const result = fmt(1500000);
        expect(result).toContain('1');
        expect(result).toContain('500');
        expect(result).toContain('000');
    });
    
    it('trả về "0" khi null', () => {
        expect(fmt(null)).toBe('0');
    });
});

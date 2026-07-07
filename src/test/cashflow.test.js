import { describe, it, expect } from 'vitest';
import {
    aggregateActuals, aggregateActualsByProject, planToBuckets, planByProject,
    toPeriods, rollingBalance, sumRows, rowTotal, emptyBuckets, ALL_KEYS, OVERHEAD, CF_PERM,
} from '../lib/cashflow';

const YEAR = 2026;
const payments = [{ id: 'st1', project_id: 'A' }, { id: 'st2', project_id: 'B' }];
const loans = [
    { id: 'L1', project_id: 'A', loan_date: '2026-02-10', loan_amount: 1000 },
    { id: 'L2', project_id: null, loan_date: '2025-12-01', loan_amount: 500 }, // khác năm -> bỏ
];
const src = {
    payments, loans,
    extHist: [
        { payment_stage_id: 'st1', payment_date: '2026-01-15', amount: 300 },
        { payment_stage_id: 'st2', payment_date: '2026-03-20', amount: 700 },
        { payment_stage_id: 'st1', payment_date: '2025-06-01', amount: 999 }, // khác năm
    ],
    loanPayments: [{ loan_id: 'L1', payment_date: '2026-02-28', principal_amount: 100, interest_amount: 20 }],
    expMaterials: [
        { project_id: 'A', expense_date: '2026-01-05', paid_amount: 50 },
        { project_id: 'B', expense_date: '2026-04-05', paid_amount: 80 },
    ],
    expLabor: [{ project_id: 'A', payment_date: '2026-01-10', paid_amount: 40 }],
    expenses: [
        { project_id: 'A', expense_type: 'BCH công trường', paid_date: '2026-01-20', paid_amount: 10 },
        { project_id: 'A', expense_type: 'Nghiệm thu/Thẩm duyệt', paid_date: '2026-02-01', paid_amount: 5 },
        { project_id: null, expense_type: 'Vận hành', paid_date: '2026-03-01', paid_amount: 30 },   // overhead
        { project_id: 'B', expense_type: 'Chi phí chung', paid_date: '2026-03-02', paid_amount: 7 }, // -> office
        { project_id: null, expense_type: 'Thiết kế', paid_date: '2026-05-01', paid_amount: 15 },    // -> design overhead
    ],
    treasury: [
        { type: 'IN', category: 'Lãi tiền gửi', transaction_date: '2026-05-01', amount: 12, project_id: null },
        { type: 'IN', category: 'Thu từ dự án', transaction_date: '2026-05-01', amount: 999, project_id: 'A' }, // loại
    ],
};

describe('aggregateActuals — toàn công ty (tổng mọi dự án + overhead)', () => {
    const b = aggregateActuals(src, { year: YEAR, projectId: null });
    it('thu dự án', () => { expect(b.project[0]).toBe(300); expect(b.project[2]).toBe(700); });
    it('vay trong năm', () => { expect(rowTotal(b.loan)).toBe(1000); });
    it('trả nợ = gốc+lãi', () => { expect(b.debt[1]).toBe(120); });
    it('map expense_type mới: office & design tách riêng', () => {
        expect(b.command[0]).toBe(10);
        expect(b.acceptance[1]).toBe(5);
        expect(b.operation[2]).toBe(30);
        expect(b.office[2]).toBe(7);     // Chi phí chung -> office
        expect(b.design[4]).toBe(15);    // Thiết kế -> design
        expect(rowTotal(b.other_out)).toBe(0);
    });
    it('vật liệu/nhân công/thu khác', () => {
        expect(b.material[0]).toBe(50); expect(b.material[3]).toBe(80);
        expect(b.labor[0]).toBe(40); expect(b.other_in[4]).toBe(12);
    });
});

describe('aggregateActuals — lọc dự án A / overhead', () => {
    it('dự án A chỉ dữ liệu A', () => {
        const b = aggregateActuals(src, { year: YEAR, projectId: 'A' });
        expect(rowTotal(b.project)).toBe(300);
        expect(rowTotal(b.material)).toBe(50);
        expect(rowTotal(b.debt)).toBe(120);
        expect(rowTotal(b.operation)).toBe(0); // vận hành là overhead
    });
    it('overhead chỉ chi phí chung không theo dự án', () => {
        const b = aggregateActuals(src, { year: YEAR, projectId: OVERHEAD });
        expect(rowTotal(b.operation)).toBe(30);
        expect(rowTotal(b.design)).toBe(15);
        expect(rowTotal(b.material)).toBe(0);
    });
});

describe('aggregateActualsByProject', () => {
    const bp = aggregateActualsByProject(src, { year: YEAR });
    it('tách theo dự án + overhead', () => {
        expect(bp.material.A[0]).toBe(50);
        expect(bp.material.B[3]).toBe(80);
        expect(bp.operation[OVERHEAD][2]).toBe(30);
        expect(bp.design[OVERHEAD][4]).toBe(15);
    });
});

describe('planToBuckets / planByProject', () => {
    const rows = [
        { year: 2026, month: 1, category: 'material', planned_amount: 100, project_id: null },
        { year: 2026, month: 3, category: 'material', planned_amount: 200, project_id: 'A' },
        { year: 2025, month: 1, category: 'material', planned_amount: 999, project_id: null },
    ];
    it('toàn cty = tổng mọi dự án + overhead', () => {
        const b = planToBuckets(rows, { year: 2026, projectId: null });
        expect(b.material[0]).toBe(100); // overhead
        expect(b.material[2]).toBe(200); // dự án A
    });
    it('theo dự án A', () => {
        const b = planToBuckets(rows, { year: 2026, projectId: 'A' });
        expect(b.material[2]).toBe(200); expect(b.material[0]).toBe(0);
    });
    it('overhead', () => {
        const b = planToBuckets(rows, { year: 2026, projectId: OVERHEAD });
        expect(b.material[0]).toBe(100); expect(b.material[2]).toBe(0);
    });
    it('planByProject tách đúng', () => {
        const bp = planByProject(rows, { year: 2026 });
        expect(bp.material.A[2]).toBe(200);
        expect(bp.material[OVERHEAD][0]).toBe(100);
    });
});

describe('quyền theo hạng mục', () => {
    it('mapping perm đúng', () => {
        expect(CF_PERM.material).toBe('manage_materials_tracking');
        expect(CF_PERM.labor).toBe('manage_labor');
        expect(CF_PERM.project).toBe('edit_payments');
        expect(CF_PERM.office).toBe('manage_expenses');
        expect(CF_PERM.loan).toBe('manage_loans');
    });
});

describe('toPeriods & rollingBalance', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    it('quý', () => expect(toPeriods(arr, 'quarter')).toEqual([6, 15, 24, 33]));
    it('năm', () => expect(toPeriods(arr, 'year')).toEqual([78]));
    it('số dư lũy kế', () => {
        const { net, closing } = rollingBalance([100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [30, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 1000);
        expect(net[0]).toBe(70); expect(closing[0]).toBe(1070); expect(closing[1]).toBe(1020);
    });
});

describe('emptyBuckets & sumRows', () => {
    it('đủ hạng mục', () => { const b = emptyBuckets(); for (const k of ALL_KEYS) expect(b[k]).toHaveLength(12); });
    it('sumRows', () => expect(sumRows({ a: [1, 1, 0], b: [2, 0, 0] }, ['a', 'b']).slice(0, 3)).toEqual([3, 1, 0]));
});

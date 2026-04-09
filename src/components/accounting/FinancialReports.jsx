import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────
function fmt(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return Number(v).toLocaleString('vi-VN');
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('vi-VN');
}

const TABS = [
  { key: 'trial', label: 'Cân đối Phát sinh', icon: 'table_chart' },
  { key: 'balance', label: 'Bảng CĐKT (B01-DN)', icon: 'account_balance' },
  { key: 'income', label: 'KQKD (B02-DN)', icon: 'trending_up' },
];

// ─── B01-DN Balance Sheet structure (TT200) ───────────────────
const B01_ASSETS_SHORT = [
  { code: '111', label: 'Tiền mặt' },
  { code: '112', label: 'Tiền gửi ngân hàng' },
  { code: '131', label: 'Phải thu của khách hàng' },
  { code: '133', label: 'Thuế GTGT được khấu trừ' },
  { code: '136', label: 'Phải thu nội bộ' },
  { code: '138', label: 'Phải thu khác' },
  { code: '141', label: 'Tạm ứng' },
  { code: '152', label: 'Nguyên liệu, vật liệu' },
  { code: '153', label: 'Công cụ, dụng cụ' },
  { code: '154', label: 'Chi phí SXKD dở dang' },
  { code: '155', label: 'Thành phẩm' },
];
const B01_ASSETS_LONG = [
  { code: '211', label: 'TSCĐ hữu hình', sign: 1 },
  { code: '214', label: 'Hao mòn TSCĐ (trừ)', sign: -1 },
  { code: '242', label: 'Chi phí trả trước' },
];
const B01_LIABILITIES = [
  { code: '331', label: 'Phải trả cho người bán' },
  { code: '333', label: 'Thuế và các khoản phải nộp NN' },
  { code: '334', label: 'Phải trả người lao động' },
  { code: '335', label: 'Chi phí phải trả' },
  { code: '338', label: 'Phải trả, phải nộp khác' },
  { code: '341', label: 'Vay và nợ thuê tài chính' },
];
const B01_EQUITY = [
  { code: '411', label: 'Vốn đầu tư của chủ sở hữu' },
  { code: '421', label: 'Lợi nhuận sau thuế chưa phân phối' },
];

// ─── B02-DN Income Statement structure (TT200) ───────────────
const B02_ROWS = [
  { key: 'revenue', code: '511', label: '1. Doanh thu bán hàng và CCDV', indent: 0 },
  { key: 'deductions', code: '521', label: '2. Các khoản giảm trừ DT', indent: 0 },
  { key: 'net_revenue', label: '3. Doanh thu thuần (1-2)', indent: 0, calc: true, bold: true },
  { key: 'cogs', code: '632', label: '4. Giá vốn hàng bán', indent: 0 },
  { key: 'gross_profit', label: '5. Lợi nhuận gộp (3-4)', indent: 0, calc: true, bold: true },
  { key: 'fin_income', code: '515', label: '6. Doanh thu hoạt động tài chính', indent: 0 },
  { key: 'fin_expense', code: '635', label: '7. Chi phí tài chính', indent: 0 },
  { key: 'admin_expense', code: '642', label: '8. Chi phí quản lý doanh nghiệp', indent: 0 },
  { key: 'operating_profit', label: '9. LN thuần từ HĐKD (5+6-7-8)', indent: 0, calc: true, bold: true },
  { key: 'other_income', code: '711', label: '10. Thu nhập khác', indent: 0 },
  { key: 'other_expense', code: '811', label: '11. Chi phí khác', indent: 0 },
  { key: 'other_profit', label: '12. Lợi nhuận khác (10-11)', indent: 0, calc: true, bold: true },
  { key: 'profit_before_tax', label: '13. Tổng LN kế toán trước thuế (9+12)', indent: 0, calc: true, bold: true, highlight: true },
  { key: 'tax_expense', code: '821', label: '14. Chi phí thuế TNDN', indent: 0 },
  { key: 'net_profit', label: '15. LN sau thuế TNDN (13-14)', indent: 0, calc: true, bold: true, highlight: true },
];

// ═══════════════════════════════════════════════════════════════
export default function FinancialReports() {
  const [activeTab, setActiveTab] = useState('trial');
  const [accounts, setAccounts] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  // Ledger data
  const [journalSums, setJournalSums] = useState([]);

  // ─── Fetch base data ──────────────────────────────────────
  const fetchBaseData = useCallback(async () => {
    setLoading(true);
    const [accRes, perRes, yrRes] = await Promise.all([
      supabase.from('acc_accounts').select('*').eq('is_active', true).order('account_number'),
      supabase.from('acc_fiscal_periods').select('id, name, start_date, end_date, status, fiscal_year_id').order('start_date'),
      supabase.from('acc_fiscal_years').select('*').order('year', { ascending: false }),
    ]);
    if (!accRes.error) setAccounts(accRes.data || []);
    if (!perRes.error) setPeriods(perRes.data || []);
    if (!yrRes.error) {
      setYears(yrRes.data || []);
      const current = yrRes.data?.find(y => y.is_current);
      if (current) setSelectedYear(current.id);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBaseData(); }, [fetchBaseData]);

  // Auto-select current period
  useEffect(() => {
    if (periods.length && selectedYear) {
      const yearPeriods = periods.filter(p => p.fiscal_year_id === selectedYear);
      const now = new Date();
      const current = yearPeriods.find(p => {
        const s = new Date(p.start_date), e = new Date(p.end_date);
        return now >= s && now <= e;
      });
      if (current) setSelectedPeriod(current.id);
      else if (yearPeriods.length) setSelectedPeriod(yearPeriods[yearPeriods.length - 1].id);
    }
  }, [periods, selectedYear]);

  // ─── Fetch journal sums when period changes ───────────────
  const periodInfo = useMemo(() => periods.find(p => p.id === selectedPeriod), [periods, selectedPeriod]);
  const yearInfo = useMemo(() => years.find(y => y.id === selectedYear), [years, selectedYear]);

  const fetchJournalSums = useCallback(async () => {
    if (!periodInfo) return;

    // Fetch sums per account for the selected period
    // We need: SUM(debit_amount) and SUM(credit_amount) for each account
    // where journal_entry.status = 'posted' and entry_date within period range
    const { data, error } = await supabase
      .from('acc_journal_lines')
      .select(`
        account_id,
        debit_amount,
        credit_amount,
        acc_journal_entries!inner (
          status, entry_date
        )
      `)
      .eq('acc_journal_entries.status', 'posted')
      .gte('acc_journal_entries.entry_date', periodInfo.start_date)
      .lte('acc_journal_entries.entry_date', periodInfo.end_date);

    if (error) {
      console.error('Journal sums error:', error);
      setJournalSums([]);
      return;
    }

    // Aggregate by account_id
    const sumMap = {};
    (data || []).forEach(line => {
      if (!sumMap[line.account_id]) sumMap[line.account_id] = { debit: 0, credit: 0 };
      sumMap[line.account_id].debit += parseFloat(line.debit_amount) || 0;
      sumMap[line.account_id].credit += parseFloat(line.credit_amount) || 0;
    });
    setJournalSums(sumMap);
  }, [periodInfo]);

  useEffect(() => { fetchJournalSums(); }, [fetchJournalSums]);

  // Also fetch YTD sums (from year start to period end) for B01/B02
  const [ytdSums, setYtdSums] = useState({});
  const fetchYtdSums = useCallback(async () => {
    if (!yearInfo || !periodInfo) return;

    const { data, error } = await supabase
      .from('acc_journal_lines')
      .select(`
        account_id,
        debit_amount,
        credit_amount,
        acc_journal_entries!inner (
          status, entry_date
        )
      `)
      .eq('acc_journal_entries.status', 'posted')
      .gte('acc_journal_entries.entry_date', yearInfo.start_date)
      .lte('acc_journal_entries.entry_date', periodInfo.end_date);

    if (error) { setYtdSums({}); return; }

    const sumMap = {};
    (data || []).forEach(line => {
      if (!sumMap[line.account_id]) sumMap[line.account_id] = { debit: 0, credit: 0 };
      sumMap[line.account_id].debit += parseFloat(line.debit_amount) || 0;
      sumMap[line.account_id].credit += parseFloat(line.credit_amount) || 0;
    });
    setYtdSums(sumMap);
  }, [yearInfo, periodInfo]);

  useEffect(() => { fetchYtdSums(); }, [fetchYtdSums]);

  // ──────────────────────────────────────────────────────────
  // TRIAL BALANCE computation
  // ──────────────────────────────────────────────────────────
  const trialData = useMemo(() => {
    // Only level-1 parent accounts for summary, include level-2 as children
    return accounts.map(acc => {
      const opening = parseFloat(acc.opening_balance) || 0;
      const sums = journalSums[acc.id] || { debit: 0, credit: 0 };
      const isDebitNormal = acc.normal_balance === 'debit';

      // Opening balance split into Nợ / Có columns
      const openDebit = isDebitNormal ? (opening >= 0 ? opening : 0) : (opening < 0 ? Math.abs(opening) : 0);
      const openCredit = !isDebitNormal ? (opening >= 0 ? opening : 0) : (opening < 0 ? Math.abs(opening) : 0);

      // Closing balance
      const closingRaw = isDebitNormal
        ? opening + sums.debit - sums.credit
        : opening + sums.credit - sums.debit;
      const closeDebit = isDebitNormal ? (closingRaw >= 0 ? closingRaw : 0) : (closingRaw < 0 ? Math.abs(closingRaw) : 0);
      const closeCredit = !isDebitNormal ? (closingRaw >= 0 ? closingRaw : 0) : (closingRaw < 0 ? Math.abs(closingRaw) : 0);

      const hasActivity = sums.debit > 0 || sums.credit > 0 || opening !== 0;

      return {
        ...acc, opening, openDebit, openCredit,
        psDebit: sums.debit, psCredit: sums.credit,
        closeDebit, closeCredit, hasActivity
      };
    }).filter(a => a.hasActivity || a.level === 1);
  }, [accounts, journalSums]);

  const trialTotals = useMemo(() => ({
    openDebit: trialData.filter(a => a.level === 1).reduce((s, a) => s + a.openDebit, 0),
    openCredit: trialData.filter(a => a.level === 1).reduce((s, a) => s + a.openCredit, 0),
    psDebit: trialData.filter(a => a.level === 1).reduce((s, a) => s + a.psDebit, 0),
    psCredit: trialData.filter(a => a.level === 1).reduce((s, a) => s + a.psCredit, 0),
    closeDebit: trialData.filter(a => a.level === 1).reduce((s, a) => s + a.closeDebit, 0),
    closeCredit: trialData.filter(a => a.level === 1).reduce((s, a) => s + a.closeCredit, 0),
  }), [trialData]);

  // ──────────────────────────────────────────────────────────
  // B01-DN Balance Sheet computation
  // ──────────────────────────────────────────────────────────
  const getAccountBalance = useCallback((code, sums) => {
    // Find account by account_number starting with code
    // For balance sheet, we need closing balance = opening + ytd movements
    const acc = accounts.find(a => a.account_number === code);
    if (!acc) return 0;
    const opening = parseFloat(acc.opening_balance) || 0;
    const s = sums[acc.id] || { debit: 0, credit: 0 };
    const isDebitNormal = acc.normal_balance === 'debit';

    // Get sum including all children
    const children = accounts.filter(a => a.parent_id === acc.id);
    let childDebit = 0, childCredit = 0;
    children.forEach(c => {
      const cs = sums[c.id] || { debit: 0, credit: 0 };
      childDebit += cs.debit;
      childCredit += cs.credit;
    });

    const totalDebit = s.debit + childDebit;
    const totalCredit = s.credit + childCredit;

    if (isDebitNormal) return opening + totalDebit - totalCredit;
    return opening + totalCredit - totalDebit;
  }, [accounts]);

  const balanceSheet = useMemo(() => {
    const sums = ytdSums;
    // Assets
    const shortTermItems = B01_ASSETS_SHORT.map(item => ({
      ...item, value: getAccountBalance(item.code, sums)
    }));
    const longTermItems = B01_ASSETS_LONG.map(item => ({
      ...item, value: getAccountBalance(item.code, sums) * (item.sign || 1)
    }));
    const totalShortAssets = shortTermItems.reduce((s, i) => s + i.value, 0);
    const totalLongAssets = longTermItems.reduce((s, i) => s + i.value, 0);
    const totalAssets = totalShortAssets + totalLongAssets;

    // Liabilities + Equity
    const liabilityItems = B01_LIABILITIES.map(item => ({
      ...item, value: getAccountBalance(item.code, sums)
    }));
    const equityItems = B01_EQUITY.map(item => ({
      ...item, value: getAccountBalance(item.code, sums)
    }));
    const totalLiabilities = liabilityItems.reduce((s, i) => s + i.value, 0);
    const totalEquity = equityItems.reduce((s, i) => s + i.value, 0);
    const totalSources = totalLiabilities + totalEquity;

    return {
      shortTermItems, longTermItems, totalShortAssets, totalLongAssets, totalAssets,
      liabilityItems, equityItems, totalLiabilities, totalEquity, totalSources,
      balanced: Math.abs(totalAssets - totalSources) < 1, // Allow 1 VND rounding
    };
  }, [ytdSums, getAccountBalance]);

  // ──────────────────────────────────────────────────────────
  // B02-DN Income Statement computation
  // ──────────────────────────────────────────────────────────
  const getIncomeValue = useCallback((code, sums) => {
    const acc = accounts.find(a => a.account_number === code);
    if (!acc) return 0;
    const s = sums[acc.id] || { debit: 0, credit: 0 };
    // Get sum including children
    const children = accounts.filter(a => a.parent_id === acc.id);
    let childDebit = 0, childCredit = 0;
    children.forEach(c => {
      const cs = sums[c.id] || { debit: 0, credit: 0 };
      childDebit += cs.debit;
      childCredit += cs.credit;
    });
    const totalDebit = s.debit + childDebit;
    const totalCredit = s.credit + childCredit;
    // Revenue accounts: credit-normal -> value = credit - debit
    // Expense accounts: debit-normal -> value = debit - credit
    if (acc.normal_balance === 'credit') return totalCredit - totalDebit;
    return totalDebit - totalCredit;
  }, [accounts]);

  const incomeStatement = useMemo(() => {
    const sums = ytdSums;
    const vals = {};

    // Fetch raw values
    B02_ROWS.forEach(row => {
      if (row.code) {
        vals[row.key] = getIncomeValue(row.code, sums);
      }
    });

    // Calculated rows
    vals.net_revenue = (vals.revenue || 0) - (vals.deductions || 0);
    vals.gross_profit = vals.net_revenue - (vals.cogs || 0);
    vals.operating_profit = vals.gross_profit + (vals.fin_income || 0) - (vals.fin_expense || 0) - (vals.admin_expense || 0);
    vals.other_profit = (vals.other_income || 0) - (vals.other_expense || 0);
    vals.profit_before_tax = vals.operating_profit + vals.other_profit;
    vals.net_profit = vals.profit_before_tax - (vals.tax_expense || 0);

    return vals;
  }, [ytdSums, getIncomeValue]);

  // ──────────────────────────────────────────────────────────
  // EXPORT PDF
  // ──────────────────────────────────────────────────────────
  const exportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(10);
    doc.text('CÔNG TY CP XÂY DỰNG SATECO', 14, 15);
    doc.setFontSize(8);
    doc.text(`Ngày in: ${new Date().toLocaleDateString('vi-VN')}`, pageWidth - 14, 15, { align: 'right' });

    let title = '', startY = 25;

    if (activeTab === 'trial') {
      title = `BANG CAN DOI PHAT SINH`;
      doc.setFontSize(14);
      doc.text(title, pageWidth / 2, startY, { align: 'center' });
      doc.setFontSize(9);
      doc.text(`Ky: ${periodInfo?.name || ''}`, pageWidth / 2, startY + 7, { align: 'center' });

      const rows = trialData.filter(a => a.level === 1).map(a => [
        a.account_number, a.name,
        a.openDebit || '', a.openCredit || '',
        a.psDebit || '', a.psCredit || '',
        a.closeDebit || '', a.closeCredit || '',
      ]);
      rows.push([
        { content: 'TONG CONG', colSpan: 2, styles: { fontStyle: 'bold' } },
        trialTotals.openDebit || '', trialTotals.openCredit || '',
        trialTotals.psDebit || '', trialTotals.psCredit || '',
        trialTotals.closeDebit || '', trialTotals.closeCredit || '',
      ]);

      doc.autoTable({
        startY: startY + 12,
        head: [['Ma TK', 'Ten tai khoan', 'Du DK No', 'Du DK Co', 'PS No', 'PS Co', 'Du CK No', 'Du CK Co']],
        body: rows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 20 }, 1: { cellWidth: 60 },
          2: { halign: 'right' }, 3: { halign: 'right' },
          4: { halign: 'right' }, 5: { halign: 'right' },
          6: { halign: 'right' }, 7: { halign: 'right' },
        },
      });
    }

    if (activeTab === 'balance') {
      title = 'BANG CAN DOI KE TOAN (B01-DN)';
      doc.setFontSize(14);
      doc.text(title, pageWidth / 2, startY, { align: 'center' });
      doc.setFontSize(9);
      doc.text(`Tai ngay: ${periodInfo ? fmtDate(periodInfo.end_date) : ''}`, pageWidth / 2, startY + 7, { align: 'center' });

      const rows = [];
      rows.push([{ content: 'A. TAI SAN NGAN HAN', colSpan: 2, styles: { fontStyle: 'bold' } }, fmt(balanceSheet.totalShortAssets)]);
      balanceSheet.shortTermItems.forEach(i => rows.push(['', `${i.code} - ${i.label}`, fmt(i.value)]));
      rows.push([{ content: 'B. TAI SAN DAI HAN', colSpan: 2, styles: { fontStyle: 'bold' } }, fmt(balanceSheet.totalLongAssets)]);
      balanceSheet.longTermItems.forEach(i => rows.push(['', `${i.code} - ${i.label}`, fmt(i.value)]));
      rows.push([{ content: 'TONG CONG TAI SAN', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [219, 234, 254] } }, { content: fmt(balanceSheet.totalAssets), styles: { fontStyle: 'bold', fillColor: [219, 234, 254] } }]);
      rows.push([]);
      rows.push([{ content: 'A. NO PHAI TRA', colSpan: 2, styles: { fontStyle: 'bold' } }, fmt(balanceSheet.totalLiabilities)]);
      balanceSheet.liabilityItems.forEach(i => rows.push(['', `${i.code} - ${i.label}`, fmt(i.value)]));
      rows.push([{ content: 'B. VON CHU SO HUU', colSpan: 2, styles: { fontStyle: 'bold' } }, fmt(balanceSheet.totalEquity)]);
      balanceSheet.equityItems.forEach(i => rows.push(['', `${i.code} - ${i.label}`, fmt(i.value)]));
      rows.push([{ content: 'TONG CONG NGUON VON', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [219, 234, 254] } }, { content: fmt(balanceSheet.totalSources), styles: { fontStyle: 'bold', fillColor: [219, 234, 254] } }]);

      doc.autoTable({
        startY: startY + 12,
        head: [['', 'Chi tieu', 'So tien']],
        body: rows,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        columnStyles: { 0: { cellWidth: 10 }, 2: { halign: 'right', cellWidth: 45 } },
      });
    }

    if (activeTab === 'income') {
      title = 'BAO CAO KET QUA HOAT DONG KINH DOANH (B02-DN)';
      doc.setFontSize(13);
      doc.text(title, pageWidth / 2, startY, { align: 'center' });
      doc.setFontSize(9);
      doc.text(`Ky: ${yearInfo ? `01/01 - ${fmtDate(periodInfo?.end_date)}` : ''} ${yearInfo?.year || ''}`, pageWidth / 2, startY + 7, { align: 'center' });

      const rows = B02_ROWS.map(row => [
        row.label,
        fmt(incomeStatement[row.key] || 0),
      ]);

      doc.autoTable({
        startY: startY + 12,
        head: [['Chi tieu', 'So tien']],
        body: rows,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        columnStyles: { 1: { halign: 'right', cellWidth: 55 } },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const row = B02_ROWS[data.row.index];
            if (row?.bold) data.cell.styles.fontStyle = 'bold';
            if (row?.highlight) data.cell.styles.fillColor = [254, 249, 195];
          }
        },
      });
    }

    // Footer signatures
    const finalY = doc.lastAutoTable?.finalY || 200;
    doc.setFontSize(9);
    doc.text('Nguoi lap bieu', 50, finalY + 20, { align: 'center' });
    doc.text('Ke toan truong', pageWidth / 2, finalY + 20, { align: 'center' });
    doc.text('Giam doc', pageWidth - 50, finalY + 20, { align: 'center' });

    const tabLabel = TABS.find(t => t.key === activeTab)?.label || 'report';
    doc.save(`${tabLabel.replace(/\s/g, '_')}_${periodInfo?.name || 'report'}.pdf`);
  };

  // ──────────────────────────────────────────────────────────
  // EXPORT EXCEL
  // ──────────────────────────────────────────────────────────
  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    let ws, sheetName;

    if (activeTab === 'trial') {
      const rows = trialData.filter(a => a.level === 1).map(a => ({
        'Mã TK': a.account_number,
        'Tên tài khoản': a.name,
        'Dư ĐK Nợ': a.openDebit || 0,
        'Dư ĐK Có': a.openCredit || 0,
        'PS Nợ': a.psDebit || 0,
        'PS Có': a.psCredit || 0,
        'Dư CK Nợ': a.closeDebit || 0,
        'Dư CK Có': a.closeCredit || 0,
      }));
      rows.push({
        'Mã TK': 'TỔNG CỘNG', 'Tên tài khoản': '',
        'Dư ĐK Nợ': trialTotals.openDebit, 'Dư ĐK Có': trialTotals.openCredit,
        'PS Nợ': trialTotals.psDebit, 'PS Có': trialTotals.psCredit,
        'Dư CK Nợ': trialTotals.closeDebit, 'Dư CK Có': trialTotals.closeCredit,
      });
      ws = XLSX.utils.json_to_sheet(rows);
      sheetName = 'CDPS';
    }

    if (activeTab === 'balance') {
      const rows = [];
      rows.push({ 'Chỉ tiêu': 'A. TÀI SẢN NGẮN HẠN', 'Số tiền': balanceSheet.totalShortAssets });
      balanceSheet.shortTermItems.forEach(i => rows.push({ 'Chỉ tiêu': `  ${i.code} - ${i.label}`, 'Số tiền': i.value }));
      rows.push({ 'Chỉ tiêu': 'B. TÀI SẢN DÀI HẠN', 'Số tiền': balanceSheet.totalLongAssets });
      balanceSheet.longTermItems.forEach(i => rows.push({ 'Chỉ tiêu': `  ${i.code} - ${i.label}`, 'Số tiền': i.value }));
      rows.push({ 'Chỉ tiêu': 'TỔNG TÀI SẢN', 'Số tiền': balanceSheet.totalAssets });
      rows.push({ 'Chỉ tiêu': '' });
      rows.push({ 'Chỉ tiêu': 'A. NỢ PHẢI TRẢ', 'Số tiền': balanceSheet.totalLiabilities });
      balanceSheet.liabilityItems.forEach(i => rows.push({ 'Chỉ tiêu': `  ${i.code} - ${i.label}`, 'Số tiền': i.value }));
      rows.push({ 'Chỉ tiêu': 'B. VỐN CHỦ SỞ HỮU', 'Số tiền': balanceSheet.totalEquity });
      balanceSheet.equityItems.forEach(i => rows.push({ 'Chỉ tiêu': `  ${i.code} - ${i.label}`, 'Số tiền': i.value }));
      rows.push({ 'Chỉ tiêu': 'TỔNG NGUỒN VỐN', 'Số tiền': balanceSheet.totalSources });
      ws = XLSX.utils.json_to_sheet(rows);
      sheetName = 'B01-DN';
    }

    if (activeTab === 'income') {
      const rows = B02_ROWS.map(row => ({
        'Chỉ tiêu': row.label,
        'Số tiền': incomeStatement[row.key] || 0,
      }));
      ws = XLSX.utils.json_to_sheet(rows);
      sheetName = 'B02-DN';
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const tabLabel = TABS.find(t => t.key === activeTab)?.label || 'report';
    XLSX.writeFile(wb, `${tabLabel.replace(/\s/g, '_')}_${periodInfo?.name || 'report'}.xlsx`);
  };

  // ──────────────────────────────────────────────────────────
  // Filter bar: Period selector by year
  // ──────────────────────────────────────────────────────────
  const yearPeriods = useMemo(() => periods.filter(p => p.fiscal_year_id === selectedYear), [periods, selectedYear]);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* ─── Tab Bar + Filters ──────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold transition-all cursor-pointer ${
                activeTab === tab.key
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="p-4 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex gap-3 items-center flex-wrap">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Năm</label>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/20">
                {years.map(y => <option key={y.id} value={y.id}>{y.year} {y.is_current ? '(Hiện tại)' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Kỳ kế toán</label>
              <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/20">
                {yearPeriods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {periodInfo && (
              <div className="text-[11px] text-slate-400 mt-4">
                {fmtDate(periodInfo.start_date)} → {fmtDate(periodInfo.end_date)}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={exportExcel}
              className="px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">table_view</span> Excel
            </button>
            <button onClick={exportPDF}
              className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors cursor-pointer flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span> PDF
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <>
          {/* ═══ TAB 1: TRIAL BALANCE ═══ */}
          {activeTab === 'trial' && (
            <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-3 border-b border-r border-slate-200" rowSpan={2}>Mã TK</th>
                      <th className="py-3 px-3 border-b border-r border-slate-200" rowSpan={2}>Tên tài khoản</th>
                      <th className="py-2 px-3 border-b border-r border-slate-200 text-center" colSpan={2}>Số dư đầu kỳ</th>
                      <th className="py-2 px-3 border-b border-r border-slate-200 text-center" colSpan={2}>Phát sinh trong kỳ</th>
                      <th className="py-2 px-3 border-b border-slate-200 text-center" colSpan={2}>Số dư cuối kỳ</th>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                      <th className="py-2 px-3 text-right border-r border-slate-100 text-blue-500">Nợ</th>
                      <th className="py-2 px-3 text-right border-r border-slate-200 text-orange-500">Có</th>
                      <th className="py-2 px-3 text-right border-r border-slate-100 text-blue-500">Nợ</th>
                      <th className="py-2 px-3 text-right border-r border-slate-200 text-orange-500">Có</th>
                      <th className="py-2 px-3 text-right border-r border-slate-100 text-blue-500">Nợ</th>
                      <th className="py-2 px-3 text-right text-orange-500">Có</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialData.map(acc => (
                      <tr key={acc.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${acc.level === 1 ? 'font-semibold' : 'text-slate-600'}`}>
                        <td className="py-2 px-3 font-mono text-[13px]" style={{ paddingLeft: acc.level > 1 ? `${(acc.level - 1) * 20 + 12}px` : undefined }}>
                          {acc.account_number}
                        </td>
                        <td className="py-2 px-3 text-[13px]">{acc.name}</td>
                        <td className="py-2 px-3 text-right font-mono text-[12px] text-blue-700">{acc.openDebit > 0 ? fmt(acc.openDebit) : ''}</td>
                        <td className="py-2 px-3 text-right font-mono text-[12px] text-orange-600">{acc.openCredit > 0 ? fmt(acc.openCredit) : ''}</td>
                        <td className="py-2 px-3 text-right font-mono text-[12px] text-blue-700">{acc.psDebit > 0 ? fmt(acc.psDebit) : ''}</td>
                        <td className="py-2 px-3 text-right font-mono text-[12px] text-orange-600">{acc.psCredit > 0 ? fmt(acc.psCredit) : ''}</td>
                        <td className="py-2 px-3 text-right font-mono text-[12px] text-blue-700 font-bold">{acc.closeDebit > 0 ? fmt(acc.closeDebit) : ''}</td>
                        <td className="py-2 px-3 text-right font-mono text-[12px] text-orange-600 font-bold">{acc.closeCredit > 0 ? fmt(acc.closeCredit) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-700/40 dark:to-slate-800/20 font-bold border-t-2 border-slate-300">
                      <td className="py-3 px-3 text-xs uppercase tracking-wider text-slate-600" colSpan={2}>Tổng cộng</td>
                      <td className="py-3 px-3 text-right font-mono text-[13px] text-blue-700">{fmt(trialTotals.openDebit)}</td>
                      <td className="py-3 px-3 text-right font-mono text-[13px] text-orange-600">{fmt(trialTotals.openCredit)}</td>
                      <td className="py-3 px-3 text-right font-mono text-[13px] text-blue-700">{fmt(trialTotals.psDebit)}</td>
                      <td className="py-3 px-3 text-right font-mono text-[13px] text-orange-600">{fmt(trialTotals.psCredit)}</td>
                      <td className="py-3 px-3 text-right font-mono text-[13px] text-blue-700">{fmt(trialTotals.closeDebit)}</td>
                      <td className="py-3 px-3 text-right font-mono text-[13px] text-orange-600">{fmt(trialTotals.closeCredit)}</td>
                    </tr>
                    {/* Balance check */}
                    <tr className="bg-white dark:bg-slate-800/30">
                      <td colSpan={8} className="py-2 px-3 text-center">
                        {Math.abs(trialTotals.psDebit - trialTotals.psCredit) < 1 ? (
                          <span className="text-xs font-bold text-emerald-600 flex items-center justify-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            Cân bằng: Tổng PS Nợ = Tổng PS Có
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-rose-600 flex items-center justify-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px]">error</span>
                            Chênh lệch PS: {fmt(Math.abs(trialTotals.psDebit - trialTotals.psCredit))}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ═══ TAB 2: BALANCE SHEET B01-DN ═══ */}
          {activeTab === 'balance' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Assets */}
              <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center gap-2">
                  <span className="material-symbols-outlined text-white text-[20px]">account_balance</span>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Tài sản</h3>
                  <span className="ml-auto text-white/80 text-xs font-mono font-bold">{fmt(balanceSheet.totalAssets)}</span>
                </div>
                <table className="w-full">
                  <tbody>
                    {/* Short-term */}
                    <tr className="bg-blue-50/50 dark:bg-blue-900/10 border-b border-slate-100">
                      <td className="py-2.5 px-4 text-xs font-black text-blue-700 uppercase" colSpan={2}>A. Tài sản ngắn hạn</td>
                      <td className="py-2.5 px-4 text-right font-mono text-sm font-bold text-blue-700">{fmt(balanceSheet.totalShortAssets)}</td>
                    </tr>
                    {balanceSheet.shortTermItems.map(item => (
                      <tr key={item.code} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-2 px-4 pl-8 font-mono text-xs text-slate-500 w-[60px]">{item.code}</td>
                        <td className="py-2 px-4 text-[13px] text-slate-700">{item.label}</td>
                        <td className="py-2 px-4 text-right font-mono text-[13px] text-slate-800 font-medium">{fmt(item.value)}</td>
                      </tr>
                    ))}
                    {/* Long-term */}
                    <tr className="bg-blue-50/50 dark:bg-blue-900/10 border-b border-slate-100">
                      <td className="py-2.5 px-4 text-xs font-black text-blue-700 uppercase" colSpan={2}>B. Tài sản dài hạn</td>
                      <td className="py-2.5 px-4 text-right font-mono text-sm font-bold text-blue-700">{fmt(balanceSheet.totalLongAssets)}</td>
                    </tr>
                    {balanceSheet.longTermItems.map(item => (
                      <tr key={item.code} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-2 px-4 pl-8 font-mono text-xs text-slate-500 w-[60px]">{item.code}</td>
                        <td className="py-2 px-4 text-[13px] text-slate-700">{item.label}</td>
                        <td className="py-2 px-4 text-right font-mono text-[13px] text-slate-800 font-medium">{fmt(item.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/20 font-bold border-t-2 border-blue-300">
                      <td className="py-3 px-4 text-xs font-black text-blue-800 uppercase" colSpan={2}>Tổng cộng Tài sản</td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-black text-blue-800">{fmt(balanceSheet.totalAssets)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Sources (Liabilities + Equity) */}
              <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-green-600 flex items-center gap-2">
                  <span className="material-symbols-outlined text-white text-[20px]">assured_workload</span>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Nguồn vốn</h3>
                  <span className="ml-auto text-white/80 text-xs font-mono font-bold">{fmt(balanceSheet.totalSources)}</span>
                </div>
                <table className="w-full">
                  <tbody>
                    {/* Liabilities */}
                    <tr className="bg-orange-50/50 dark:bg-orange-900/10 border-b border-slate-100">
                      <td className="py-2.5 px-4 text-xs font-black text-orange-700 uppercase" colSpan={2}>A. Nợ phải trả</td>
                      <td className="py-2.5 px-4 text-right font-mono text-sm font-bold text-orange-700">{fmt(balanceSheet.totalLiabilities)}</td>
                    </tr>
                    {balanceSheet.liabilityItems.map(item => (
                      <tr key={item.code} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-2 px-4 pl-8 font-mono text-xs text-slate-500 w-[60px]">{item.code}</td>
                        <td className="py-2 px-4 text-[13px] text-slate-700">{item.label}</td>
                        <td className="py-2 px-4 text-right font-mono text-[13px] text-slate-800 font-medium">{fmt(item.value)}</td>
                      </tr>
                    ))}
                    {/* Equity */}
                    <tr className="bg-purple-50/50 dark:bg-purple-900/10 border-b border-slate-100">
                      <td className="py-2.5 px-4 text-xs font-black text-purple-700 uppercase" colSpan={2}>B. Vốn chủ sở hữu</td>
                      <td className="py-2.5 px-4 text-right font-mono text-sm font-bold text-purple-700">{fmt(balanceSheet.totalEquity)}</td>
                    </tr>
                    {balanceSheet.equityItems.map(item => (
                      <tr key={item.code} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-2 px-4 pl-8 font-mono text-xs text-slate-500 w-[60px]">{item.code}</td>
                        <td className="py-2 px-4 text-[13px] text-slate-700">{item.label}</td>
                        <td className="py-2 px-4 text-right font-mono text-[13px] text-slate-800 font-medium">{fmt(item.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/20 font-bold border-t-2 border-emerald-300">
                      <td className="py-3 px-4 text-xs font-black text-emerald-800 uppercase" colSpan={2}>Tổng cộng Nguồn vốn</td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-black text-emerald-800">{fmt(balanceSheet.totalSources)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Balance check banner */}
              <div className="lg:col-span-2">
                <div className={`rounded-2xl p-4 flex items-center justify-center gap-3 font-bold text-sm ${
                  balanceSheet.balanced
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border border-rose-200 text-rose-700'
                }`}>
                  <span className="material-symbols-outlined text-[20px]">
                    {balanceSheet.balanced ? 'check_circle' : 'error'}
                  </span>
                  {balanceSheet.balanced
                    ? `Cân đối: Tổng TS (${fmt(balanceSheet.totalAssets)}) = Tổng NV (${fmt(balanceSheet.totalSources)})`
                    : `KHÔNG CÂN ĐỐI: TS (${fmt(balanceSheet.totalAssets)}) ≠ NV (${fmt(balanceSheet.totalSources)}) — Chênh lệch: ${fmt(Math.abs(balanceSheet.totalAssets - balanceSheet.totalSources))}`
                  }
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB 3: INCOME STATEMENT B02-DN ═══ */}
          {activeTab === 'income' && (
            <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-r from-purple-500 to-pink-600 flex items-center gap-2">
                <span className="material-symbols-outlined text-white text-[20px]">trending_up</span>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Báo cáo Kết quả HĐKD — Mẫu B02-DN
                </h3>
                <span className="ml-auto text-white/80 text-xs font-medium">
                  Lũy kế từ đầu năm đến {periodInfo ? fmtDate(periodInfo.end_date) : ''}
                </span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-5 text-left w-[50px]">TT</th>
                    <th className="py-3 px-5 text-left">Chỉ tiêu</th>
                    <th className="py-3 px-5 text-left w-[70px]">Mã TK</th>
                    <th className="py-3 px-5 text-right w-[180px]">Số tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {B02_ROWS.map((row, i) => {
                    const val = incomeStatement[row.key] || 0;
                    const isPositive = val >= 0;
                    return (
                      <tr key={row.key} className={`border-b transition-colors ${
                        row.highlight ? 'bg-amber-50/80 dark:bg-amber-900/10 border-amber-200' :
                        row.bold ? 'bg-slate-50/50 border-slate-200' : 'border-slate-50 hover:bg-slate-50/50'
                      }`}>
                        <td className="py-2.5 px-5 text-xs text-slate-400 font-mono">{String(i + 1).padStart(2, '0')}</td>
                        <td className={`py-2.5 px-5 text-[13px] ${row.bold ? 'font-bold text-slate-900' : 'text-slate-700'} ${row.highlight ? 'text-amber-800 font-black' : ''}`}>
                          {row.label}
                        </td>
                        <td className="py-2.5 px-5 font-mono text-xs text-slate-400">
                          {row.code || ''}
                        </td>
                        <td className={`py-2.5 px-5 text-right font-mono text-[13px] font-bold ${
                          row.highlight ? (isPositive ? 'text-emerald-700' : 'text-rose-700') :
                          row.bold ? 'text-slate-900' : 'text-slate-700'
                        }`}>
                          {fmt(val)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Summary cards */}
              <div className="p-5 bg-slate-50/50 border-t border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'DT thuần', value: incomeStatement.net_revenue, color: 'text-blue-700' },
                  { label: 'LN gộp', value: incomeStatement.gross_profit, color: 'text-emerald-700' },
                  { label: 'LN trước thuế', value: incomeStatement.profit_before_tax, color: 'text-amber-700' },
                  { label: 'LN sau thuế', value: incomeStatement.net_profit, color: incomeStatement.net_profit >= 0 ? 'text-emerald-700' : 'text-rose-700' },
                ].map(card => (
                  <div key={card.label} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200/50 p-3 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{card.label}</p>
                    <p className={`text-lg font-black mt-1 tabular-nums ${card.color}`}>{fmt(card.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

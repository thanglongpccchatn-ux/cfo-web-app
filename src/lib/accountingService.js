/**
 * 🏦 accountingService.js — Auto Journal Entry Service
 * 
 * Centralized service for automatically creating journal entries
 * when business transactions occur (payments, receipts, loans, etc.)
 * 
 * All auto-created entries have status = 'draft' so accountants can
 * review and post them manually.
 * 
 * Usage:
 *   import { createAutoJournalEntry, autoJournal } from '../lib/accountingService';
 *   
 *   // Generic:
 *   await createAutoJournalEntry({ journalType, entryDate, description, lines: [...] });
 *   
 *   // Shortcuts:
 *   await autoJournal.laborPayment(labor, paidAmount, paymentDate);
 *   await autoJournal.supplierPayment(po, supplier, amount, form);
 *   await autoJournal.customerReceipt(stage, amount, date, projectName);
 *   await autoJournal.loanPayment(loan, principal, interest, date);
 */

import { supabase } from './supabase';
import { EventBus } from './eventBus';

// ─── Account Number → ID cache (lazy loaded) ─────────────
let accountCache = null;

async function getAccountMap() {
  if (accountCache) return accountCache;
  const { data } = await supabase
    .from('acc_accounts')
    .select('id, account_number, name, normal_balance')
    .eq('is_active', true);
  accountCache = new Map();
  (data || []).forEach(acc => accountCache.set(acc.account_number, acc));
  return accountCache;
}

// Invalidate cache when accounts change
EventBus.on('db:acc_accounts:insert', () => { accountCache = null; });
EventBus.on('db:acc_accounts:update', () => { accountCache = null; });

// ─── Find active fiscal period for a date ─────────────────
async function findPeriod(entryDate) {
  const { data } = await supabase
    .from('acc_fiscal_periods')
    .select('id')
    .lte('start_date', entryDate)
    .gte('end_date', entryDate)
    .eq('status', 'open')
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

// ─── Idempotency check ────────────────────────────────────
async function hasExistingEntry(sourceModule, sourceId) {
  if (!sourceModule || !sourceId) return false;
  const { data } = await supabase
    .from('acc_journal_entries')
    .select('id')
    .eq('source_module', sourceModule)
    .eq('source_id', sourceId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

// ═══════════════════════════════════════════════════════════
// CORE: createAutoJournalEntry
// ═══════════════════════════════════════════════════════════

/**
 * Create an auto-generated journal entry with lines.
 * 
 * @param {Object} params
 * @param {string} params.journalType - Journal type key (e.g. 'bank_payment')
 * @param {string} params.entryDate - Date string YYYY-MM-DD
 * @param {string} params.description - Entry description
 * @param {string} [params.referenceNumber] - Reference number
 * @param {string} [params.sourceModule] - Source module for tracing
 * @param {string} [params.sourceId] - Source record UUID
 * @param {string} [params.projectId] - Related project UUID
 * @param {Array<{accountNumber: string, debit: number, credit: number, description?: string}>} params.lines
 * @returns {Promise<{success: boolean, entryId?: string, error?: string}>}
 */
export async function createAutoJournalEntry(params) {
  const {
    journalType = 'general',
    entryDate,
    description,
    referenceNumber,
    sourceModule,
    sourceId,
    projectId,
    lines = [],
  } = params;

  try {
    // 1. Idempotency: skip if already created
    if (sourceModule && sourceId) {
      const exists = await hasExistingEntry(sourceModule, sourceId);
      if (exists) {
        console.log(`[AccountingService] Entry already exists for ${sourceModule}:${sourceId}, skipping`);
        return { success: true, skipped: true };
      }
    }

    // 2. Validate lines balance
    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 1) {
      return { success: false, error: `Unbalanced: Debit ${totalDebit} ≠ Credit ${totalCredit}` };
    }

    // 3. Resolve account numbers → IDs
    const accountMap = await getAccountMap();
    const resolvedLines = [];
    for (const line of lines) {
      const acc = accountMap.get(line.accountNumber);
      if (!acc) {
        console.warn(`[AccountingService] Account ${line.accountNumber} not found, skipping entry`);
        return { success: false, error: `Tài khoản ${line.accountNumber} không tồn tại` };
      }
      resolvedLines.push({
        account_id: acc.id,
        debit_amount: line.debit || 0,
        credit_amount: line.credit || 0,
        description: line.description || description,
      });
    }

    // 4. Find fiscal period
    const periodId = await findPeriod(entryDate);
    if (!periodId) {
      console.warn(`[AccountingService] No open fiscal period for ${entryDate}`);
      return { success: false, error: `Không tìm thấy kỳ kế toán mở cho ngày ${entryDate}` };
    }

    // 5. Insert journal entry
    const { data: entry, error: entryErr } = await supabase
      .from('acc_journal_entries')
      .insert([{
        journal_type: journalType,
        entry_date: entryDate,
        description: `[Tự động] ${description}`,
        reference_number: referenceNumber || null,
        fiscal_period_id: periodId,
        total_debit: totalDebit,
        total_credit: totalCredit,
        status: 'draft',
        source_module: sourceModule || null,
        source_id: sourceId || null,
      }])
      .select('id')
      .single();

    if (entryErr) {
      console.error('[AccountingService] Entry insert error:', entryErr);
      return { success: false, error: entryErr.message };
    }

    // 6. Insert journal lines
    const linePayloads = resolvedLines.map((line, idx) => ({
      journal_entry_id: entry.id,
      line_number: idx + 1,
      ...line,
    }));

    const { error: lineErr } = await supabase
      .from('acc_journal_lines')
      .insert(linePayloads);

    if (lineErr) {
      console.error('[AccountingService] Lines insert error:', lineErr);
      // Rollback entry
      await supabase.from('acc_journal_entries').delete().eq('id', entry.id);
      return { success: false, error: lineErr.message };
    }

    // 7. Emit event
    EventBus.emit('journal:auto_created', {
      entryId: entry.id,
      journalType,
      description,
      totalDebit,
      sourceModule,
      sourceId,
    });

    console.log(`[AccountingService] ✅ Auto journal created: ${description} (${totalDebit.toLocaleString('vi-VN')}đ)`);
    return { success: true, entryId: entry.id };

  } catch (err) {
    console.error('[AccountingService] Unexpected error:', err);
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════
// SHORTCUT METHODS (one-liner for each business flow)
// ═══════════════════════════════════════════════════════════

export const autoJournal = {
  /**
   * CP Nhân công: Nợ 622 / Có 334
   * Called from LaborPaymentModal after paid
   */
  async laborPayment(labor, paidAmount, paymentDate) {
    return createAutoJournalEntry({
      journalType: 'payroll',
      entryDate: paymentDate,
      description: `CP nhân công — ${labor.team_name || ''}${labor.projects?.code ? ` (${labor.projects.code})` : ''}`,
      referenceNumber: labor.id?.slice(0, 8),
      sourceModule: 'expense_labor',
      sourceId: labor.id,
      projectId: labor.project_id,
      lines: [
        { accountNumber: '622', debit: paidAmount, credit: 0, description: `NC: ${labor.team_name}` },
        { accountNumber: '334', debit: 0, credit: paidAmount, description: `Phải trả NLĐ: ${labor.team_name}` },
      ],
    });
  },

  /**
   * TT NCC: Nợ 331 / Có 112 (CK) hoặc Có 111 (TM)
   * Called from SupplierPaymentModal after payment
   */
  async supplierPayment(po, supplier, amount, form) {
    const isCash = form?.paymentMethod === 'Tiền mặt';
    const creditAccount = isCash ? '111' : '112';
    const journalType = isCash ? 'cash_payment' : 'bank_payment';

    return createAutoJournalEntry({
      journalType,
      entryDate: form?.paymentDate || new Date().toISOString().split('T')[0],
      description: `TT NCC ${supplier?.name || ''} — PO ${po?.code || ''}`,
      referenceNumber: form?.referenceNumber || po?.code,
      sourceModule: 'po_payment',
      sourceId: po?.id,
      projectId: po?.project_id,
      lines: [
        { accountNumber: '331', debit: amount, credit: 0, description: `Trả NCC: ${supplier?.name || ''}` },
        { accountNumber: creditAccount, debit: 0, credit: amount, description: `Chi ${isCash ? 'tiền mặt' : 'CK'}: ${po?.code || ''}` },
      ],
    });
  },

  /**
   * Thu tiền KH: Nợ 112 / Có 131
   * Called from PaymentTracking/DocumentTracking after recording customer receipt
   */
  async customerReceipt(stage, amount, paymentDate, projectName) {
    return createAutoJournalEntry({
      journalType: 'bank_receipt',
      entryDate: paymentDate,
      description: `Thu tiền KH — ${stage?.stage_name || ''} ${projectName || ''}`,
      sourceModule: 'external_payment',
      sourceId: stage?.id,
      lines: [
        { accountNumber: '112', debit: amount, credit: 0, description: `Nhận CK từ CĐT` },
        { accountNumber: '131', debit: 0, credit: amount, description: `Giảm công nợ KH` },
      ],
    });
  },

  /**
   * Trả nợ vay:
   *   Gốc: Nợ 341 / Có 112
   *   Lãi: Nợ 635 / Có 112
   * Called from LoanManagement after loan_payments insert
   */
  async loanPayment(loan, principalAmount, interestAmount, paymentDate) {
    const lines = [];
    const totalOut = principalAmount + interestAmount;

    if (principalAmount > 0) {
      lines.push({ accountNumber: '341', debit: principalAmount, credit: 0, description: `Trả gốc: ${loan.lender_name}` });
    }
    if (interestAmount > 0) {
      lines.push({ accountNumber: '635', debit: interestAmount, credit: 0, description: `Trả lãi vay: ${loan.lender_name}` });
    }
    if (totalOut > 0) {
      lines.push({ accountNumber: '112', debit: 0, credit: totalOut, description: `CK trả nợ vay` });
    }

    if (lines.length < 2) return { success: false, error: 'No amounts' };

    return createAutoJournalEntry({
      journalType: 'bank_payment',
      entryDate: paymentDate,
      description: `Trả nợ vay — ${loan.lender_name}${loan.loan_code ? ` (${loan.loan_code})` : ''}`,
      referenceNumber: loan.loan_code,
      sourceModule: 'loan_payment',
      sourceId: loan.id,
      projectId: loan.project_id,
      lines,
    });
  },

  /**
   * CP Chung: Nợ 627/642/623 / Có 112 (CK) hoặc 111 (TM)
   * Called from ExpenseTracking after approve/save
   */
  async generalExpense(expense, projectCode) {
    const amount = Number(expense.paid_amount || expense.amount) || 0;
    if (amount <= 0) return { success: false, error: 'No amount' };

    // Map expense_type → TK Nợ
    const typeMap = {
      'BCH công trường': '627',
      'Nghiệm thu/Thẩm duyệt': '627',
      'Chi phí chung': '642',
      'Vận hành': '642',
      'Máy thi công': '623',
      'Khác': '811',
    };
    const debitAccount = typeMap[expense.expense_type] || '642';

    return createAutoJournalEntry({
      journalType: 'bank_payment',
      entryDate: expense.paid_date || expense.expense_date || new Date().toISOString().split('T')[0],
      description: `CP chung — ${expense.expense_type} ${projectCode || ''}`,
      sourceModule: 'expense_general',
      sourceId: expense.id,
      projectId: expense.project_id,
      lines: [
        { accountNumber: debitAccount, debit: amount, credit: 0, description: `${expense.expense_type}: ${expense.description || ''}` },
        { accountNumber: '112', debit: 0, credit: amount, description: `Chi CK: ${expense.expense_type}` },
      ],
    });
  },

  /**
   * Kết chuyển cuối kỳ TK 911
   * Chuyển số dư các TK DT (5xx, 7xx) và CP (6xx) về TK 911
   * Rồi kết chuyển lãi/lỗ từ 911 → 4212
   * 
   * @param {string} periodId - Fiscal period UUID
   * @param {string} entryDate - Closing date
   * @param {Object} balances - { revenue: number, expenses: number } (pre-calculated)
   * @returns {Promise<{success: boolean}>}
   */
  async periodClosing(periodId, entryDate, balances) {
    const { revenue = 0, costOfGoods = 0, operatingExp = 0, financialExp = 0, otherIncome = 0, otherExp = 0 } = balances;
    const lines = [];

    // Step 1: Kết chuyển DT bán hàng → 911
    if (revenue > 0) {
      lines.push({ accountNumber: '511', debit: revenue, credit: 0, description: 'KC DT bán hàng → 911' });
    }
    if (otherIncome > 0) {
      lines.push({ accountNumber: '711', debit: otherIncome, credit: 0, description: 'KC Thu nhập khác → 911' });
    }

    // Step 2: Kết chuyển CP → 911
    if (costOfGoods > 0) {
      lines.push({ accountNumber: '911', debit: costOfGoods, credit: 0, description: 'KC Giá vốn → 911' });
    }
    if (operatingExp > 0) {
      lines.push({ accountNumber: '911', debit: operatingExp, credit: 0, description: 'KC CP QLDN → 911' });
    }
    if (financialExp > 0) {
      lines.push({ accountNumber: '911', debit: financialExp, credit: 0, description: 'KC CP tài chính → 911' });
    }
    if (otherExp > 0) {
      lines.push({ accountNumber: '911', debit: otherExp, credit: 0, description: 'KC CP khác → 911' });
    }

    // Credit side: 911 receives revenue
    const totalRevenue = revenue + otherIncome;
    const totalExpense = costOfGoods + operatingExp + financialExp + otherExp;
    if (totalRevenue > 0) {
      lines.push({ accountNumber: '911', debit: 0, credit: totalRevenue, description: 'Nhận DT kết chuyển' });
    }
    // Debit costs from original accounts
    if (costOfGoods > 0) lines.push({ accountNumber: '632', debit: 0, credit: costOfGoods, description: 'KC Giá vốn' });
    if (operatingExp > 0) lines.push({ accountNumber: '642', debit: 0, credit: operatingExp, description: 'KC CP QLDN' });
    if (financialExp > 0) lines.push({ accountNumber: '635', debit: 0, credit: financialExp, description: 'KC CP tài chính' });
    if (otherExp > 0) lines.push({ accountNumber: '811', debit: 0, credit: otherExp, description: 'KC CP khác' });

    // Step 3: Kết chuyển lãi/lỗ 911 → 4212
    const profitLoss = totalRevenue - totalExpense;
    if (profitLoss > 0) {
      // Lãi: Nợ 911 / Có 4212
      lines.push({ accountNumber: '911', debit: profitLoss, credit: 0, description: 'KC Lãi → LNST chưa PP' });
      lines.push({ accountNumber: '4212', debit: 0, credit: profitLoss, description: 'LN sau thuế chưa PP' });
    } else if (profitLoss < 0) {
      // Lỗ: Nợ 4212 / Có 911
      lines.push({ accountNumber: '4212', debit: Math.abs(profitLoss), credit: 0, description: 'Lỗ kỳ này' });
      lines.push({ accountNumber: '911', debit: 0, credit: Math.abs(profitLoss), description: 'KC Lỗ → LNST chưa PP' });
    }

    if (lines.length < 2) return { success: false, error: 'Không có số liệu để kết chuyển' };

    return createAutoJournalEntry({
      journalType: 'closing',
      entryDate,
      description: `Kết chuyển cuối kỳ — TK 911`,
      sourceModule: 'period_closing',
      sourceId: periodId,
      lines,
    });
  },
};

export default { createAutoJournalEntry, autoJournal };

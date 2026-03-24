/**
 * Financial Calculation Utilities
 * Các hàm tính toán tài chính cốt lõi được định kiểu bằng TypeScript.
 */

export function calculateVAT(preVatValue: number | string, vatPercentage: number = 8, customVatAmount: number | string | null = null): { vatAmount: number, postVatValue: number } {
    const value = typeof preVatValue === 'string' ? parseFloat(preVatValue) : preVatValue || 0;
    const vatAmt = customVatAmount != null ? (typeof customVatAmount === 'string' ? parseFloat(customVatAmount) : customVatAmount) : value * (vatPercentage / 100);
    return {
        vatAmount: vatAmt,
        postVatValue: value + vatAmt,
    };
}

export function calculateSatecoRevenue(postVatValue: number | string, contractRatio: number | string = 98, customRevenue: number | string | null = null): number {
    if (customRevenue != null && parseFloat(customRevenue as string) > 0) {
        return parseFloat(customRevenue as string);
    }
    return (parseFloat(postVatValue as string) || 0) * (parseFloat(contractRatio as string) / 100);
}

export function calculateGrossProfit(totalIncome: number | string, actualRatio: number | string = 95.5, totalExpenses: number | string = 0): number {
    const income = parseFloat(totalIncome as string) || 0;
    const expenses = parseFloat(totalExpenses as string) || 0;
    return (income * (parseFloat(actualRatio as string) / 100)) - expenses;
}

export function calculateInvoiceDebt(totalInvoice: number | string, totalIncome: number | string): number {
    return (parseFloat(totalInvoice as string) || 0) - (parseFloat(totalIncome as string) || 0);
}

export function calculateRecoveryRate(totalIncome: number | string, totalContractValue: number | string): number {
    const value = parseFloat(totalContractValue as string) || 0;
    if (value <= 0) return 0;
    return ((parseFloat(totalIncome as string) || 0) / value) * 100;
}

export function calculateSPI(startDate: string | Date, endDate: string | Date, totalInvoice: number | string, plannedRevenue: number | string, today: Date = new Date()): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.max(1, (end.getTime() - start.getTime()) / 86400000);
    const passedDays = Math.max(0, (today.getTime() - start.getTime()) / 86400000);
    const planned = (parseFloat(plannedRevenue as string) || 0) * Math.min(1, passedDays / totalDays);
    if (planned <= 0) return 1;
    return (parseFloat(totalInvoice as string) || 0) / planned;
}

export function calculateSafetyRatio(totalIncome: number | string, totalExpenses: number | string): number {
    const expenses = parseFloat(totalExpenses as string) || 0;
    if (expenses <= 0) return 0;
    return (parseFloat(totalIncome as string) || 0) / expenses;
}

export function formatBillion(value: number): string {
    if (!value) return '0';
    return (value / 1000000000).toLocaleString('vi-VN', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
    });
}

export function formatVND(value: number): string {
    return value ? Number(Math.round(value)).toLocaleString('vi-VN') : '0';
}

import React from 'react';

export default function FinancialMatrixTables({ filter, data }) {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 min-h-full">
            <h1 className="text-2xl font-black text-blue-800 mb-6 uppercase">Financial Matrix (Pivot Tables)</h1>
            <p className="text-slate-500">Đang phát triển các bảng số liệu dựa trên dữ liệu năm {filter.year}...</p>
        </div>
    );
}

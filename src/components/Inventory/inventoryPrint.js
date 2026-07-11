import { fmt } from '../../utils/formatters';

const money = (v) => fmt(Math.round(Number(v) || 0));
const qtyFmt = (v) => { const n = Number(v) || 0; return Number.isInteger(n) ? n.toLocaleString('vi-VN') : n.toLocaleString('vi-VN', { maximumFractionDigits: 2 }); };

/**
 * In PHIẾU XUẤT KHO. slip = { code, issue_date, projectLabel, subcontractor_name, notes,
 *   lines: [{ product_name, unit, quantity, unit_price }] }
 */
export function printIssueSlip(slip, hidePrice = false) {
  const priceHead = hidePrice ? '' : '<th style="width:110px">Đơn giá</th><th style="width:130px">Thành tiền</th>';
  const rows = (slip.lines || []).map((l, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${l.product_name || ''}</td>
      <td style="text-align:center">${l.unit || ''}</td>
      <td style="text-align:right">${qtyFmt(l.quantity)}</td>
      ${hidePrice ? '' : `<td style="text-align:right">${money(l.unit_price)}</td><td style="text-align:right">${money((Number(l.quantity) || 0) * (Number(l.unit_price) || 0))}</td>`}
    </tr>`).join('');
  const total = (slip.lines || []).reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);
  const totalRow = hidePrice ? '' : `<tr><td colspan="5" style="text-align:right"><b>TỔNG CỘNG</b></td><td style="text-align:right"><b>${money(total)}</b></td></tr>`;
  const d = new Date(slip.issue_date);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${slip.code || 'Phiếu xuất kho'}</title>
    <style>
      body{font-family:'Times New Roman',serif;color:#000;padding:24px;font-size:14px}
      h2{text-align:center;margin:4px 0}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #000;padding:5px 8px}
      th{background:#f0f0f0}
      .head{display:flex;justify-content:space-between;font-size:13px}
      .sign{display:flex;justify-content:space-around;margin-top:40px;text-align:center;font-size:13px}
      .sign div{width:30%}
      @media print{button{display:none}}
    </style></head><body>
    <div class="head"><div><b>CÔNG TY CP CƠ ĐIỆN & PCCC SATECO</b><br/>Dự án: ${slip.projectLabel || ''}</div>
      <div style="text-align:right">Số phiếu: <b>${slip.code || ''}</b><br/>Ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}</div></div>
    <h2>PHIẾU XUẤT KHO</h2>
    <div>Người nhận: <b>${(slip.subcontractor_name || '').toUpperCase()}</b></div>
    <div>Lý do xuất: ${slip.notes || 'Xuất vật tư thi công'}</div>
    <table><thead><tr><th style="width:36px">STT</th><th>Tên vật tư</th><th style="width:60px">ĐVT</th><th style="width:90px">Số lượng</th>${priceHead}</tr></thead>
    <tbody>${rows}${totalRow}</tbody></table>
    <div class="sign"><div><b>Người lập phiếu</b><br/>(Ký, họ tên)</div><div><b>Thủ kho</b><br/>(Ký, họ tên)</div><div><b>Người nhận</b><br/>(Ký, họ tên)</div></div>
    <button onclick="window.print()" style="margin-top:24px;padding:8px 16px">In</button>
    </body></html>`;
  const w = window.open('', '_blank', 'width=900,height=700');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
}

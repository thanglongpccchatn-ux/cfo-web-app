import { fmt } from '../../utils/formatters';

const money = (v) => fmt(Math.round(Number(v) || 0));
const qtyFmt = (v) => { const n = Number(v) || 0; return Number.isInteger(n) ? n.toLocaleString('vi-VN') : n.toLocaleString('vi-VN', { maximumFractionDigits: 2 }); };
// Chống XSS: escape mọi chuỗi tự do trước khi nhét vào HTML của cửa sổ in.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * In PHIẾU XUẤT KHO. slip = { code, issue_date, projectLabel, subcontractor_name, notes,
 *   lines: [{ product_name, unit, quantity, unit_price }] }
 */
export function printIssueSlip(slip, hidePrice = false) {
  const priceHead = hidePrice ? '' : '<th style="width:110px">Đơn giá</th><th style="width:130px">Thành tiền</th>';
  const rows = (slip.lines || []).map((l, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${esc(l.product_name)}</td>
      <td style="text-align:center">${esc(l.unit)}</td>
      <td style="text-align:right">${qtyFmt(l.quantity)}</td>
      ${hidePrice ? '' : `<td style="text-align:right">${money(l.unit_price)}</td><td style="text-align:right">${money((Number(l.quantity) || 0) * (Number(l.unit_price) || 0))}</td>`}
    </tr>`).join('');
  const total = (slip.lines || []).reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);
  const totalRow = hidePrice ? '' : `<tr><td colspan="5" style="text-align:right"><b>TỔNG CỘNG</b></td><td style="text-align:right"><b>${money(total)}</b></td></tr>`;
  const d = new Date(slip.issue_date);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(slip.code || 'Phiếu xuất kho')}</title>
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
    <div class="head"><div><b>CÔNG TY CP CƠ ĐIỆN & PCCC SATECO</b><br/>Dự án: ${esc(slip.projectLabel)}</div>
      <div style="text-align:right">Số phiếu: <b>${esc(slip.code)}</b><br/>Ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}</div></div>
    <h2>PHIẾU XUẤT KHO</h2>
    <div>Người nhận: <b>${esc((slip.subcontractor_name || '').toUpperCase())}</b></div>
    <div>Lý do xuất: ${esc(slip.notes || 'Xuất vật tư thi công')}</div>
    <table><thead><tr><th style="width:36px">STT</th><th>Tên vật tư</th><th style="width:60px">ĐVT</th><th style="width:90px">Số lượng</th>${priceHead}</tr></thead>
    <tbody>${rows}${totalRow}</tbody></table>
    <div class="sign"><div><b>Người lập phiếu</b><br/>(Ký, họ tên)</div><div><b>Thủ kho</b><br/>(Ký, họ tên)</div><div><b>Người nhận</b><br/>(Ký, họ tên)</div></div>
    <button onclick="window.print()" style="margin-top:24px;padding:8px 16px">In</button>
    </body></html>`;
  const w = window.open('', '_blank', 'width=900,height=700');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
}

/**
 * In PHIẾU ĐỀ NGHỊ VẬT TƯ. req = { code, request_date, projectLabel, subcontractor_name, notes }
 * items = [{ material_group, product_name, unit, contract_qty, qty_requested, note }]
 */
export function printRequestSlip(req, items) {
  const rows = (items || []).map((it, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:center">${esc(it.material_group)}</td>
      <td>${esc(it.product_name)}</td>
      <td style="text-align:center">${esc(it.unit)}</td>
      <td style="text-align:right">${it.contract_qty ? qtyFmt(it.contract_qty) : ''}</td>
      <td style="text-align:right">${qtyFmt(it.qty_requested)}</td>
      <td>${esc(it.note)}</td>
    </tr>`).join('');
  const d = new Date(req.request_date);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(req.code || 'Phiếu đề nghị vật tư')}</title>
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
    <div class="head"><div><b>CÔNG TY CP CƠ ĐIỆN & PCCC SATECO</b><br/>Dự án: ${esc(req.projectLabel)}</div>
      <div style="text-align:right">Số phiếu: <b>${esc(req.code)}</b><br/>Ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}</div></div>
    <h2>PHIẾU ĐỀ NGHỊ VẬT TƯ</h2>
    <div>Đơn vị đề nghị: <b>${esc((req.subcontractor_name || '').toUpperCase())}</b></div>
    <div>Nội dung: ${esc(req.notes || 'Đề nghị cấp vật tư thi công')}</div>
    <table><thead><tr>
      <th style="width:36px">STT</th><th style="width:70px">Nhóm VT</th><th>Tên vật tư</th>
      <th style="width:56px">ĐVT</th><th style="width:90px">KL hợp đồng</th><th style="width:90px">SL đề nghị</th><th style="width:120px">Ghi chú</th>
    </tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="sign"><div><b>Người đề nghị</b><br/>(Ký, họ tên)</div><div><b>Chỉ huy trưởng</b><br/>(Ký, họ tên)</div><div><b>Thủ kho</b><br/>(Ký, họ tên)</div></div>
    <button onclick="window.print()" style="margin-top:24px;padding:8px 16px">In</button>
    </body></html>`;
  const w = window.open('', '_blank', 'width=900,height=700');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
}

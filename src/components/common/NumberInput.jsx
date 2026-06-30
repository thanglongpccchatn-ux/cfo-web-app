/**
 * NumberInput — ô nhập số tiền có DẤU PHÂN CÁCH NGHÌN (1.250.000).
 * Hiển thị định dạng vi-VN, trả về số thuần qua onChange(number).
 * Dùng cho đơn giá / thành tiền — dễ đọc, ít sai khi nhập tiền lớn.
 */
import { useState, useEffect } from 'react';
import { formatInputNumber, parseFormattedNumber } from '../../utils/formatters';

export default function NumberInput({ value, onChange, className = '', ...rest }) {
    const [text, setText] = useState(formatInputNumber(value));

    // Đồng bộ khi value bên ngoài đổi (vd autocomplete tự điền giá) — không clobber khi đang gõ
    useEffect(() => {
        if (parseFormattedNumber(text) !== (Number(value) || 0)) {
            setText(formatInputNumber(value));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const handleChange = (e) => {
        const raw = e.target.value;
        if (raw === '') { setText(''); onChange(0); return; }
        const num = parseFormattedNumber(raw);
        setText(formatInputNumber(num));
        onChange(num);
    };

    return (
        <input
            type="text"
            inputMode="numeric"
            value={text}
            onChange={handleChange}
            className={className}
            {...rest}
        />
    );
}

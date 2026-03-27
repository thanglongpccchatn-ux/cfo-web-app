import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const GUIDE_DATA = [
    {
        code: 'ROLE01', name: 'Trưởng phòng dự án / Admin',
        desc: 'Toàn quyền hệ thống — quản trị người dùng, phân quyền, và truy cập mọi module.',
        icon: 'admin_panel_settings', color: 'from-red-500 to-rose-600',
        sections: [
            { title: 'Quản lý Người dùng & Phân quyền', steps: [
                'Vào Quản lý Người dùng (sidebar → HỆ THỐNG) → Thêm người dùng mới',
                'Nhập Email, Họ tên, chọn Vai trò → Hệ thống tự gửi email mời',
                'Vào Quản lý Phân quyền → chọn vai trò → nhấn icon ⚙️ để cấu hình quyền',
                'Tick/bỏ tick từng quyền hoặc nhấn "Chọn tất cả" theo nhóm module',
                'Nhấn "Áp dụng quyền hạn" để lưu → User cần đăng xuất/đăng nhập lại',
            ]},
            { title: 'Tổng quan Dashboard', steps: [
                'Nhấn Tổng quan → xem KPI tài chính: Tổng HĐ, Thực thu, Công nợ',
                'Đọc SATECO AI Insights — cảnh báo tự động về doanh thu, công nợ',
                'Biểu đồ Xu hướng Thực thu (6 tháng) và Cơ cấu Giá trị',
                'Nhấn "Thiết lập Mục tiêu" để thay đổi mục tiêu doanh thu năm',
            ]},
            { title: 'Quản lý Hợp đồng', steps: [
                'Vào Hợp đồng → xem toàn bộ danh sách HĐ với Chủ đầu tư',
                'Nhấn "Tạo hợp đồng" → nhập tên, mã, giá trị, hạng mục, mốc thanh toán',
                'Click vào dự án → xem chi tiết tài chính, addendum, thanh toán',
                'Sửa (✏️) hoặc Xóa (🗑️) hợp đồng — hệ thống ghi audit log',
            ]},
            { title: 'Cài đặt hệ thống', steps: [
                'Vào Cài đặt → thay đổi thương hiệu (logo, tên công ty, màu)',
                'Cấu hình giao diện hiển thị toàn hệ thống',
            ]},
        ]
    },
    {
        code: 'KETOAN', name: 'Kế toán nội bộ',
        desc: 'Theo dõi chi phí, vật tư, đối soát công nợ nhà thầu phụ.',
        icon: 'account_balance', color: 'from-emerald-500 to-teal-600',
        sections: [
            { title: 'Theo dõi Chi phí Chung', steps: [
                'Vào Chi phí Chung → chọn dự án từ dropdown',
                'Xem bảng chi phí: nhóm chi phí, hạng mục, đơn giá, thành tiền',
                'Nhấn "Thêm chi phí" → nhập loại chi phí, số tiền, ngày phát sinh',
                'Có thể sửa/xóa chi phí đã tạo',
            ]},
            { title: 'Theo dõi Vật tư (chỉ xem)', steps: [
                'Vào Theo dõi Vật tư → chọn dự án',
                'Xem danh sách vật tư đã nhập, đơn giá, tồn kho',
                'Kiểm tra đối chiếu với hóa đơn nhà cung cấp',
            ]},
            { title: 'Xem Thầu phụ / Tổ đội', steps: [
                'Vào Nhà thầu phụ / Tổ đội — xem danh sách đối tác',
                'Kiểm tra công nợ, lịch sử thanh toán với từng thầu phụ',
            ]},
        ]
    },
    {
        code: 'NHANSU', name: 'Nhân sự',
        desc: 'Quản lý, thống kê và theo dõi chấm công nhân sự, tổ đội thi công.',
        icon: 'badge', color: 'from-fuchsia-500 to-pink-600',
        sections: [
            { title: 'Theo dõi Nhân công', steps: [
                'Vào "Theo dõi Nhân công" → chọn dự án từ danh sách',
                'Xem và điền bảng chấm công, số ngày công, đơn giá từng nhân sự',
                'Cập nhật dữ liệu công nhật hàng ngày/tuần',
                'Chốt bảng công để gửi duyệt thanh toán lương',
            ]},
            { title: 'Xem Nhà thầu phụ / Tổ đội', steps: [
                'Vào "Nhà thầu phụ / Tổ đội" → xem danh sách các tổ đội',
                'Kiểm tra thông tin liên hệ và năng lực tổ đội cơ bản',
            ]},
        ]
    },
    {
        code: 'DAUTHAU', name: 'Đấu thầu',
        desc: 'Tạo, quản lý gói thầu và báo giá. Quản lý nhân sự thầu phụ/tổ đội.',
        icon: 'assignment_turned_in', color: 'from-blue-500 to-indigo-600',
        sections: [
            { title: 'Quản lý Đấu thầu & Báo giá', steps: [
                'Vào Đấu thầu → nhấn "Tạo gói thầu"',
                'Nhập: tên gói thầu, CĐT, giá trị dự toán, hạn nộp',
                'Tạo Báo giá: nhập hạng mục công việc, đơn giá, khối lượng',
                'Quản lý phiên bản (v1, v2...) → so sánh biên lợi nhuận',
                'Cập nhật trạng thái: Nháp → Đã nộp → Trúng thầu / Không trúng',
            ]},
            { title: 'Quản lý Nhà thầu phụ & Tổ đội', steps: [
                'Vào Nhà thầu phụ / Tổ đội → nhấn "Thêm"',
                'Nhập: tên, loại hình (thầu phụ/tổ đội), liên hệ',
                'Gán thầu phụ vào dự án cụ thể',
            ]},
            { title: 'Theo dõi Nhân công', steps: [
                'Vào Theo dõi Nhân công → chọn dự án',
                'Xem bảng chấm công, số ngày công, đơn giá',
                'Nhập dữ liệu nhân công theo ngày/tuần',
            ]},
        ]
    },
    {
        code: 'ROLE02', name: 'Giám đốc',
        desc: 'Xem báo cáo tổng hợp, duyệt thanh toán cuối cùng. Chủ yếu quyền XEM.',
        icon: 'person_celebrate', color: 'from-amber-500 to-orange-600',
        sections: [
            { title: 'Xem tổng quan tài chính', steps: [
                'Đăng nhập → tự động vào Tổng quan Dashboard',
                'Kiểm tra KPI: Tổng giá trị HĐ, Thực thu, Công nợ, Tỷ lệ thu hồi',
                'Đọc AI Insights để nắm cảnh báo quan trọng',
                'Xem biểu đồ xu hướng 6 tháng',
            ]},
            { title: 'Duyệt thanh toán', steps: [
                'Vào Hồ sơ & Thanh toán → xem danh sách đề nghị TT',
                'Mở chi tiết từng hồ sơ → kiểm tra chứng từ',
                'Nhấn "Duyệt" hoặc "Từ chối" để cập nhật trạng thái',
            ]},
            { title: 'Xem tiến độ dự án', steps: [
                'Vào Thi công → xem tiến độ tổng thể từng dự án',
                'Vào Kế hoạch & Báo cáo → xem kế hoạch dòng tiền',
                'Vào Quyết Toán → kiểm tra trạng thái quyết toán',
            ]},
        ]
    },
    {
        code: 'ROLE03', name: 'Bộ phận vật tư',
        desc: 'Quản lý NCC, mua sắm, nhập xuất kho tổng.',
        icon: 'inventory_2', color: 'from-cyan-500 to-sky-600',
        sections: [
            { title: 'Quản lý Nhà cung cấp', steps: [
                'Vào Nhà cung cấp → xem sổ cái NCC (tổng đặt, thực nhận, công nợ)',
                'Nhấn "Nhập đơn mua hàng" → chọn NCC, dự án, ngày',
                'Thêm dòng vật tư → gõ tên, hệ thống suggest từ danh mục',
                'Nhấn "Tạo đơn" → PO tự sinh mã (PO-2026xxxx)',
            ]},
            { title: 'Nhận hàng (Goods Receipt)', steps: [
                'Trong bảng NCC → click mở rộng (▶) → xem PO',
                'Với PO chưa hoàn tất → nhấn "Nhận hàng"',
                'Nhập SL thực nhận → "Xác nhận" → tự cập nhật tồn kho',
            ]},
            { title: 'Nhập/Xuất kho', steps: [
                'Vào Kho vật tư → tab Nhập kho hoặc Xuất kho',
                'Chọn kho, dự án, vật tư cần nhập/xuất',
                'Nhập SL, đơn giá, ghi chú → Lưu phiếu',
            ]},
        ]
    },
    {
        code: 'ROLE04', name: 'Bộ phận kiểm soát khối lượng',
        desc: 'Kiểm soát đơn hàng, khối lượng thi công thực tế.',
        icon: 'straighten', color: 'from-violet-500 to-purple-600',
        sections: [
            { title: 'Kiểm soát khối lượng', steps: [
                'Vào Thi công → chọn dự án',
                'Xem khối lượng Kế hoạch vs Thực tế theo hạng mục',
                'Nhập khối lượng hoàn thành thực tế theo ngày/tuần',
                'Vào Nhật ký hiện trường → ghi nhận tiến độ, ảnh chụp',
                'Đối chiếu Theo dõi Vật tư để kiểm tra tiêu hao',
            ]},
        ]
    },
    {
        code: 'ROLE05', name: 'Bộ phận thanh toán thầu phụ',
        desc: 'Quản lý thanh toán cho nhà thầu phụ, duyệt hồ sơ.',
        icon: 'payments', color: 'from-pink-500 to-rose-600',
        sections: [
            { title: 'Thanh toán thầu phụ', steps: [
                'Vào Hồ sơ & Thanh toán → chọn dự án',
                'Xem lịch sử giai đoạn TT (đề nghị, hóa đơn, thực chi)',
                'Nhấn "Tạo đề nghị thanh toán" → nhập đợt, giá trị, NCC/thầu phụ',
                'Tải lên hồ sơ chứng từ đính kèm',
                'Theo dõi trạng thái: Chờ duyệt → Đã duyệt → Đã thanh toán',
                'Vào Nhà thầu phụ / Tổ đội → kiểm tra công nợ tổng hợp',
            ]},
        ]
    },
    {
        code: 'ROLE06', name: 'Bộ phận theo dõi hợp đồng',
        desc: 'Theo dõi hợp đồng CĐT, phát sinh, bảo hành, quyết toán.',
        icon: 'description', color: 'from-orange-500 to-amber-600',
        sections: [
            { title: 'Theo dõi Hợp đồng', steps: [
                'Vào Hợp đồng → xem toàn bộ danh sách HĐ với CĐT',
                'Click vào dự án → xem Dashboard chi tiết tài chính',
                'Có thể Tạo mới hoặc Sửa hợp đồng',
            ]},
            { title: 'Quản lý Phát sinh', steps: [
                'Vào Phát sinh → chọn dự án',
                'Nhấn "Thêm phát sinh" → nhập tên, loại (tăng/giảm), giá trị',
                'Cập nhật trạng thái: Đề xuất → Đang xem xét → Đã duyệt',
                'Phát sinh "Đã duyệt" tự cộng vào giá trị HĐ tổng',
            ]},
            { title: 'Thanh toán CĐT', steps: [
                'Vào Hồ sơ & Thanh toán → chọn dự án',
                'Ghi nhận: Đề nghị TT → Hóa đơn → Thu chi thực tế',
                'Công nợ = Đã xuất HĐ - Đã thu (tính tự động)',
            ]},
            { title: 'Bảo hành & Quyết toán', steps: [
                'Vào Theo dõi Bảo hành → ghi nhận thời hạn BH, chi phí',
                'Vào Quyết Toán → lập hồ sơ quyết toán khi dự án hoàn thành',
            ]},
        ]
    },
    {
        code: 'ROLE07', name: 'Quản lý dự án / Chỉ huy trưởng',
        desc: 'Duyệt yêu cầu vật tư, theo dõi tiến độ thi công tại site.',
        icon: 'engineering', color: 'from-lime-500 to-green-600',
        sections: [
            { title: 'Quản lý tại công trường', steps: [
                'Xem Tổng quan → nắm KPI dự án đang phụ trách',
                'Vào Thi công → cập nhật tiến độ hạng mục theo tuần',
                'Vào Nhật ký hiện trường → ghi nhận nhật ký hàng ngày',
                'Duyệt yêu cầu xuất kho vật tư tại Kho vật tư',
                'Theo dõi Nhân công → chấm công, kiểm tra năng suất',
                'Phối hợp Nhà thầu phụ / Tổ đội → giao việc, nghiệm thu',
            ]},
        ]
    },
    {
        code: 'ROLE08', name: 'Kỹ sư các bộ môn',
        desc: 'Tạo yêu cầu vật tư cho dự án, theo dõi tiến độ bộ môn.',
        icon: 'architecture', color: 'from-sky-500 to-blue-600',
        sections: [
            { title: 'Yêu cầu vật tư & tiến độ', steps: [
                'Vào Kho vật tư → tạo Yêu cầu vật tư cho bộ môn',
                'Chọn dự án, loại vật tư, SL cần → gửi Chỉ huy trưởng duyệt',
                'Theo dõi tiến độ bộ môn tại Thi công',
                'Xem lịch sử vật tư đã cấp tại Theo dõi Vật tư',
            ]},
        ]
    },
    {
        code: 'ROLE09', name: 'Kho dự án',
        desc: 'Nhập xuất vật tư tại công trường dự án.',
        icon: 'warehouse', color: 'from-stone-500 to-zinc-600',
        sections: [
            { title: 'Nhập xuất kho dự án', steps: [
                'Vào Kho vật tư → xem tồn kho hiện tại dự án',
                'Tab Nhập kho → ghi nhận vật tư nhận từ kho tổng hoặc NCC',
                'Tab Xuất kho → xuất vật tư cho hạng mục thi công',
                'Kiểm tra Theo dõi Vật tư → đối chiếu nhập/xuất',
            ]},
        ]
    },
    {
        code: 'ROLE10', name: 'Quản lý kho Tổng',
        desc: 'Quản lý kho tổng công ty, phê duyệt phiếu nhập/xuất.',
        icon: 'domain', color: 'from-slate-500 to-gray-600',
        sections: [
            { title: 'Quản lý kho Tổng', steps: [
                'Vào Kho vật tư → xem Dashboard tồn kho tổng',
                'Nhập kho: nhận vật tư từ NCC (theo PO đã duyệt)',
                'Xuất kho: xuất cho các dự án (theo yêu cầu)',
                'Quản lý danh mục vật tư tại Danh mục Vật tư',
            ]},
        ]
    },
    {
        code: 'ROLE11', name: 'Nhân viên kho Tổng',
        desc: 'Thực hiện nhập xuất kho tổng theo chỉ đạo.',
        icon: 'package_2', color: 'from-neutral-500 to-stone-600',
        sections: [
            { title: 'Nhập xuất kho Tổng', steps: [
                'Vào Kho vật tư → xem tồn kho',
                'Tab Nhập kho → ghi nhận vật tư nhận từ NCC',
                'Tab Xuất kho → xuất vật tư cho dự án',
            ]},
        ]
    },
];

export default function UserGuide() {
    const { profile } = useAuth();
    const userRole = profile?.role_code;
    const [expandedRole, setExpandedRole] = useState(userRole || 'ROLE01');
    const [expandedSection, setExpandedSection] = useState(null);

    const toggleRole = (code) => {
        setExpandedRole(expandedRole === code ? null : code);
        setExpandedSection(null);
    };

    const toggleSection = (key) => {
        setExpandedSection(expandedSection === key ? null : key);
    };

    return (
        <div className="max-w-5xl mx-auto pb-12 animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 rounded-2xl p-8 md:p-10 mb-8 relative overflow-hidden shadow-xl">
                <div className="absolute -right-10 -top-10 opacity-10">
                    <span className="material-symbols-outlined notranslate text-[200px] text-white" translate="no">menu_book</span>
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <span className="material-symbols-outlined notranslate text-white text-2xl" translate="no">help_center</span>
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Hướng dẫn sử dụng</h1>
                            <p className="text-blue-100 text-sm font-medium">SATECO CFO — Hệ thống quản trị tài chính dự án</p>
                        </div>
                    </div>
                    <p className="text-blue-200 text-sm mt-4 max-w-2xl leading-relaxed">
                        Chọn vai trò của bạn bên dưới để xem hướng dẫn chi tiết. Mỗi vai trò có các module và quyền hạn khác nhau.
                    </p>
                    {userRole && (
                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-sm rounded-lg border border-white/20">
                            <span className="material-symbols-outlined notranslate text-white text-[16px]" translate="no">person</span>
                            <span className="text-white text-sm font-bold">
                                Vai trò của bạn: {GUIDE_DATA.find(g => g.code === userRole)?.name || userRole}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Role Cards */}
            <div className="space-y-3">
                {GUIDE_DATA.map((role) => {
                    const isExpanded = expandedRole === role.code;
                    const isCurrentRole = userRole === role.code;

                    return (
                        <div key={role.code} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 ${isCurrentRole ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`}>
                            {/* Role Header */}
                            <button
                                onClick={() => toggleRole(role.code)}
                                className="w-full px-5 md:px-6 py-4 flex items-center gap-4 text-left hover:bg-slate-50/50 transition-colors"
                            >
                                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center shadow-md shrink-0`}>
                                    <span className="material-symbols-outlined notranslate text-white text-xl" translate="no">{role.icon}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-bold text-slate-800 text-[15px]">{role.name}</h3>
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-md uppercase tracking-wider">{role.code}</span>
                                        {isCurrentRole && (
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md">Vai trò của bạn</span>
                                        )}
                                    </div>
                                    <p className="text-slate-500 text-[13px] mt-0.5 truncate">{role.desc}</p>
                                </div>
                                <span className={`material-symbols-outlined notranslate text-slate-400 text-xl transition-transform duration-300 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} translate="no">
                                    expand_more
                                </span>
                            </button>

                            {/* Expanded Content */}
                            {isExpanded && (
                                <div className="px-5 md:px-6 pb-5 border-t border-slate-100 pt-4 space-y-2 animate-fade-in">
                                    {role.sections.map((section, sIdx) => {
                                        const sectionKey = `${role.code}-${sIdx}`;
                                        const isSectionOpen = expandedSection === sectionKey;

                                        return (
                                            <div key={sIdx} className="rounded-xl border border-slate-200 overflow-hidden">
                                                <button
                                                    onClick={() => toggleSection(sectionKey)}
                                                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-blue-50/50 transition-colors"
                                                >
                                                    <span className={`material-symbols-outlined notranslate text-[18px] transition-transform duration-200 ${isSectionOpen ? 'rotate-90 text-blue-600' : 'text-slate-400'}`} translate="no">
                                                        chevron_right
                                                    </span>
                                                    <h4 className="font-bold text-sm text-slate-700">{section.title}</h4>
                                                    <span className="ml-auto text-[11px] text-slate-400 font-medium">{section.steps.length} bước</span>
                                                </button>
                                                {isSectionOpen && (
                                                    <div className="px-4 pb-4 animate-fade-in">
                                                        <ol className="space-y-2 ml-7">
                                                            {section.steps.map((step, stepIdx) => (
                                                                <li key={stepIdx} className="flex items-start gap-3">
                                                                    <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5">
                                                                        {stepIdx + 1}
                                                                    </span>
                                                                    <span className="text-[13px] text-slate-600 leading-relaxed">{step}</span>
                                                                </li>
                                                            ))}
                                                        </ol>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Quick Reference */}
            <div className="mt-10 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 md:p-8 shadow-xl">
                <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined notranslate text-amber-400" translate="no">lightbulb</span>
                    Mẹo sử dụng nhanh
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { icon: 'search', text: 'Nhấn thanh tìm kiếm trên Header để tìm hợp đồng nhanh' },
                        { icon: 'notifications', text: 'Chuông thông báo (🔔) hiển thị cảnh báo hệ thống real-time' },
                        { icon: 'person', text: 'Nhấn avatar góc phải → Trang cá nhân để đổi mật khẩu' },
                        { icon: 'refresh', text: 'Nhấn nút ♻️ Refresh trên mỗi bảng để tải lại dữ liệu mới nhất' },
                        { icon: 'upload_file', text: 'Nhiều module hỗ trợ Import Excel — tìm nút "Import Excel"' },
                        { icon: 'phone_android', text: 'Giao diện tự co giãn trên mobile — menu sidebar thu gọn khi màn nhỏ' },
                    ].map((tip, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                            <span className="material-symbols-outlined notranslate text-blue-400 text-lg shrink-0" translate="no">{tip.icon}</span>
                            <span className="text-slate-300 text-[13px]">{tip.text}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center">
                <p className="text-slate-400 text-sm">
                    Cần hỗ trợ thêm? Liên hệ quản trị viên hệ thống hoặc email <span className="font-bold text-slate-600">admin@thanglong.com</span>
                </p>
            </div>
        </div>
    );
}

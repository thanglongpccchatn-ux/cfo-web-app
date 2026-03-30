import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { currentTheme } from '../config/brand';
import { NavLink, useLocation } from 'react-router-dom';

export default function Sidebar({ isSidebarOpen = true, setIsSidebarOpen }) {
    const { profile, hasPermission, logout } = useAuth();
    const location = useLocation();
    const activeTab = location.pathname.substring(1) || 'dashboard';
    
    // Collapsed group state — persisted in localStorage
    const [collapsed, setCollapsed] = useState(() => {
        try {
            const saved = localStorage.getItem('sidebar_collapsed');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });

    const toggleGroup = (key) => {
        setCollapsed(prev => {
            const next = { ...prev, [key]: !prev[key] };
            localStorage.setItem('sidebar_collapsed', JSON.stringify(next));
            return next;
        });
    };
    
    // Admin always has full access. Otherwise, check permissions.
    const canView = (perms) => {
        if (profile?.role_code === 'ROLE01' || profile?.role_code === 'ADMIN') return true;
        if (perms.includes('*')) return true;
        if (!perms || perms.length === 0) return false;
        return perms.some(p => hasPermission(p));
    };

    // ─── Group Definitions ───
    const menuGroups = [
        {
            key: 'overview',
            label: 'Tổng quan',
            icon: 'space_dashboard',
            items: [
                { id: 'dashboard', icon: 'grid_view', label: 'Tổng quan', perms: ['view_dashboard'] },
                { id: 'planning_hub', icon: 'analytics', label: 'Kế hoạch & Báo cáo', perms: ['view_planning', 'manage_planning'] },
            ]
        },
        {
            key: 'contracts',
            label: 'Hợp đồng & Dự án',
            icon: 'work',
            items: [
                { id: 'bidding', icon: 'assignment_turned_in', label: 'Đấu thầu', perms: ['view_bids'] },
                { id: 'contracts', icon: 'description', label: 'Hợp đồng', perms: ['view_contracts', 'create_contracts', 'edit_contracts', 'delete_contracts'] },
                { id: 'variations', icon: 'playlist_add', label: 'Phát sinh', perms: ['view_variations', 'manage_variations'] },
                { id: 'warranty_tracking', icon: 'security', label: 'Bảo hành', perms: ['view_warranty', 'manage_warranty'] },
                { id: 'settlement', icon: 'gavel', label: 'Quyết Toán', perms: ['view_settlement', 'manage_settlement'] },
            ]
        },
        {
            key: 'finance',
            label: 'Tài chính',
            icon: 'account_balance',
            items: [
                { id: 'doc_tracking', icon: 'folder_managed', label: 'Hồ sơ & Thanh toán', perms: ['view_payments', 'create_payments', 'edit_payments', 'delete_payments'] },
                { id: 'payment_receipts', icon: 'receipt_long', label: 'Lịch sử thu tiền', perms: ['view_payments'] },
                { id: 'expense_tracking', icon: 'receipt_long', label: 'Chi phí Chung', perms: ['view_expenses', 'manage_expenses'] },
                { id: 'loans', icon: 'account_balance_wallet', label: 'Vay vốn', perms: ['view_loans', 'manage_loans'] },
            ]
        },
        {
            key: 'operations',
            label: 'Vận hành',
            icon: 'construction',
            items: [
                { id: 'labor_tracking', icon: 'engineering', label: 'Nhân công', perms: ['view_labor', 'manage_labor'] },
                { id: 'suppliers', icon: 'local_shipping', label: 'Nhà cung cấp', perms: ['view_partners', 'manage_partners', 'view_materials', 'manage_materials_tracking'] },
                { id: 'subcontractors', icon: 'groups', label: 'Thầu phụ / Tổ đội', perms: ['view_subcontractors', 'manage_subcontractors'] },
                { id: 'inventory', icon: 'warehouse', label: 'Kho vật tư', perms: ['view_inventory', 'import_inventory', 'export_inventory', 'manage_materials'] },
                { id: 'site_diary', icon: 'edit_calendar', label: 'Nhật ký', perms: ['view_construction', 'manage_construction'] },
                { id: 'construction', icon: 'build', label: 'Thi công', perms: ['view_construction', 'manage_construction'] },
            ]
        },
    ];

    const systemTabs = [
        { id: 'partners', icon: 'handshake', label: 'Danh mục Dự án / Khác', perms: ['manage_users'] },
        { id: 'materials', icon: 'inventory_2', label: 'Danh mục Vật tư', perms: ['manage_materials', 'view_inventory'] },
        { id: 'settings', icon: 'settings', label: 'Cài đặt', perms: ['manage_users', 'manage_settings'] },
        { id: 'permissions', icon: 'admin_panel_settings', label: 'Phân quyền', perms: ['manage_users'] },
        { id: 'users', icon: 'person', label: 'Người dùng', perms: ['manage_users'] },
        { id: 'guide', icon: 'help_center', label: 'Hướng dẫn', perms: ['*'] },
    ].filter(tab => canView(tab.perms));

    // Filter groups: only show groups with at least 1 visible item
    const visibleGroups = menuGroups.map(g => ({
        ...g,
        items: g.items.filter(tab => canView(tab.perms))
    })).filter(g => g.items.length > 0);

    const NavItem = ({ item }) => (
        <NavLink
            to={`/${item.id}`}
            onClick={() => {
                if (window.innerWidth < 768 && setIsSidebarOpen) setIsSidebarOpen(false);
            }}
            title={!isSidebarOpen ? item.label : undefined}
            aria-label={item.label}
            className={({ isActive }) => `w-full flex items-center py-2 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${isSidebarOpen ? 'px-3 gap-2.5' : 'justify-center px-0'
                } ${isActive || (activeTab === item.id)
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white group font-medium'
                }`}
        >
            {({ isActive }) => (
                <>
                    <span className={`material-symbols-outlined text-[18px] flex-shrink-0 ${isActive || activeTab === item.id ? 'filled' : ''}`}>{item.icon}</span>
                    {isSidebarOpen && <span className="text-[13px] truncate animate-fade-in">{item.label}</span>}
                </>
            )}
        </NavLink>
    );

    return (
        <aside className={`
            fixed md:relative top-0 left-0 bottom-0 z-40
            flex-shrink-0 border-r border-slate-200 dark:border-slate-700 flex flex-col h-full shadow-2xl md:shadow-sm transition-all duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 w-64 md:w-20'}
        `} style={{ backgroundColor: 'var(--bg-sidebar-light)' }} role="navigation" aria-label="Menu điều hướng chính">
            <style>{`.dark aside { background-color: var(--bg-sidebar-dark) !important; }`}</style>

            {/* Collapse Toggle Button (Hidden on Mobile) */}
            {setIsSidebarOpen && (
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    aria-label={isSidebarOpen ? 'Thu gọn sidebar' : 'Mở rộng sidebar'}
                    className="hidden md:flex absolute -right-3.5 top-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full w-7 h-7 items-center justify-center shadow-md z-30 text-slate-400 hover:text-primary transition-colors cursor-pointer"
                >
                    <span className="material-symbols-outlined notranslate text-[16px]" translate="no">
                        {isSidebarOpen ? 'chevron_left' : 'chevron_right'}
                    </span>
                </button>
            )}

            <div className={`h-16 flex items-center border-b border-slate-100 dark:border-slate-700/50 transition-all ${isSidebarOpen ? 'px-6' : 'justify-center px-0'}`}>
                <div className="flex items-center gap-2 overflow-hidden">
                    {currentTheme.logo_url ? (
                        <div className="flex-shrink-0 flex items-center justify-center w-[52px] h-[52px] -ml-1">
                            <img src={currentTheme.logo_url} alt="Logo" className="w-full h-full object-contain drop-shadow-sm scale-110" />
                        </div>
                    ) : (
                        <div className="bg-primary shadow-sm shadow-primary/20 rounded-xl p-1 text-white flex-shrink-0 flex items-center justify-center w-10 h-10">
                            <span className="material-symbols-outlined notranslate text-[24px]" translate="no">{currentTheme.logo_icon}</span>
                        </div>
                    )}
                    {isSidebarOpen && (
                        <div className="flex flex-col whitespace-nowrap animate-fade-in pl-1">
                            <h1 className="text-slate-900 dark:text-white text-[17px] font-black leading-none tracking-tight">{currentTheme.company_name}</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-1.5">{currentTheme.sub_name}</p>
                        </div>
                    )}
                </div>
            </div>

            <nav className={`flex-1 overflow-y-auto py-4 ${isSidebarOpen ? 'px-3' : 'px-2'} no-scrollbar`}>
                {visibleGroups.map((group) => {
                    const isCollapsed = collapsed[group.key];
                    const hasActiveChild = group.items.some(item => activeTab === item.id);

                    return (
                        <div key={group.key} className="mb-1">
                            {/* Group Header */}
                            {isSidebarOpen ? (
                                <button
                                    onClick={() => toggleGroup(group.key)}
                                    aria-expanded={!isCollapsed}
                                    aria-controls={`nav-group-${group.key}`}
                                    aria-label={`${isCollapsed ? 'Mở rộng' : 'Thu gọn'} ${group.label}`}
                                    className={`w-full flex items-center justify-between px-3 py-1.5 mb-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                                        hasActiveChild ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[14px]">{group.icon}</span>
                                        <span>{group.label}</span>
                                    </div>
                                    <span className={`material-symbols-outlined text-[14px] transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>
                                        expand_more
                                    </span>
                                </button>
                            ) : (
                                <div className="w-full flex justify-center py-2 mb-1">
                                    <div className="w-5 h-px bg-slate-200 dark:bg-slate-700 rounded-full" />
                                </div>
                            )}

                            {/* Group Items */}
                            {(!isCollapsed || !isSidebarOpen) && (
                                <div id={`nav-group-${group.key}`} role="group" aria-label={group.label} className={`space-y-0.5 ${isSidebarOpen ? 'ml-0' : ''} transition-all`}>
                                    {group.items.map(item => (
                                        <NavItem key={item.id} item={item} />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* System / Administration Section */}
            <div className={`border-t border-slate-100 dark:border-slate-700/50 py-3 space-y-0.5 ${isSidebarOpen ? 'px-3' : 'px-2'} max-h-[30vh] overflow-y-auto no-scrollbar`}>
                {isSidebarOpen && <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Hệ Thống</p>}
                {systemTabs.map(item => (
                    <NavItem key={item.id} item={item} />
                ))}
            </div>

            <div className={`pb-4 ${isSidebarOpen ? 'px-3' : 'px-2'}`}>
                <div className={`mt-2 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center ${isSidebarOpen ? 'gap-3 px-1' : 'flex-col gap-3 justify-center'}`}>
                    <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center flex-shrink-0" style={{ backgroundImage: profile?.avatar_url ? `url('${profile.avatar_url}')` : "url('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix')" }}></div>
                    {isSidebarOpen ? (
                        <>
                            <div className="flex flex-col overflow-hidden text-left flex-1 animate-fade-in">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{profile?.full_name || 'Người dùng'}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{profile?.roles?.name || profile?.role_code || 'GUEST'}</p>
                            </div>
                            <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0 ml-auto cursor-pointer" title="Đăng xuất">
                                <span className="material-symbols-outlined notranslate text-[18px]" translate="no">logout</span>
                            </button>
                        </>
                    ) : (
                        <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0 cursor-pointer" title="Đăng xuất">
                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">logout</span>
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
}

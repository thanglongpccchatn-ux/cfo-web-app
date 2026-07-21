import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { currentTheme } from '../config/brand';
import { NavLink, useLocation } from 'react-router-dom';
import Icon from './common/Icon';
import { NAV_GROUPS, SYSTEM_TABS } from '../config/navigation';

/**
 * Route KHÔNG có mục riêng trên sidebar -> quy về mục cha để vẫn sáng đúng chỗ.
 * (VD: Hub 4 tab cũ, các trang chi tiết/điều hướng lại.)
 */
/**
 * Mỗi khu một màu riêng cho TIÊU ĐỀ NHÓM + icon nhóm — quét mắt là biết đang ở khu nào.
 * Class viết tĩnh (không nội suy) để Tailwind không purge mất.
 */
const GROUP_TONE = {
    overview:        'text-slate-600 dark:text-slate-300',
    bidding_group:   'text-amber-600 dark:text-amber-400',
    contracts:       'text-blue-600 dark:text-blue-400',
    finance:         'text-emerald-600 dark:text-emerald-400',
    accounting:      'text-violet-600 dark:text-violet-400',
    labor_group:     'text-cyan-600 dark:text-cyan-400',
    operations:      'text-orange-600 dark:text-orange-400',
    materials_group: 'text-teal-600 dark:text-teal-400',
    system:          'text-slate-500 dark:text-slate-400',
};
const GROUP_TONE_ACTIVE = {
    overview:        'text-slate-900 dark:text-white',
    bidding_group:   'text-amber-700 dark:text-amber-300',
    contracts:       'text-blue-700 dark:text-blue-300',
    finance:         'text-emerald-700 dark:text-emerald-300',
    accounting:      'text-violet-700 dark:text-violet-300',
    labor_group:     'text-cyan-700 dark:text-cyan-300',
    operations:      'text-orange-700 dark:text-orange-300',
    materials_group: 'text-teal-700 dark:text-teal-300',
    system:          'text-slate-800 dark:text-white',
};

const ROUTE_ALIAS = {
    labor_subcontractors: 'labor_tracking',
    subcontractors: 'labor_partners',
    material_tracking: 'supplier_payables',
    payments: 'doc_tracking',
};

export default function Sidebar({ isSidebarOpen = true, setIsSidebarOpen }) {
    const { profile, hasPermission, logout } = useAuth();
    const location = useLocation();
    const rawTab = location.pathname.substring(1) || 'dashboard';
    const activeTab = ROUTE_ALIAS[rawTab] || rawTab;

    // Sáng đúng mục kể cả khi đang ở route con (VD accounting/journals/123 -> accounting/journals)
    const isItemActive = (item) => activeTab === item.id || activeTab.startsWith(item.id + '/');
    
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

    // Chuyển trang -> tự mở nhóm chứa mục đang xem (nếu đang thu gọn) để luôn thấy chỗ sáng.
    useEffect(() => {
        const owner = NAV_GROUPS.find(g => g.items.some(it => activeTab === it.id || activeTab.startsWith(it.id + '/')));
        const key = owner?.key || (SYSTEM_TABS.some(it => activeTab === it.id) ? 'system' : null);
        if (!key) return;
        setCollapsed(prev => {
            if (!prev[key]) return prev;               // đang mở rồi -> không đụng
            const next = { ...prev, [key]: false };
            try { localStorage.setItem('sidebar_collapsed', JSON.stringify(next)); } catch { /* bỏ qua */ }
            return next;
        });
    }, [activeTab]);
    
    // Admin always has full access. Otherwise, check permissions.
    const canView = (perms) => {
        if (profile?.role_code === 'ROLE01' || profile?.role_code === 'ADMIN') return true;
        if (perms.includes('*')) return true;
        if (!perms || perms.length === 0) return false;
        return perms.some(p => hasPermission(p));
    };

    // ─── Group Definitions (nguồn chung: config/navigation.js) ───
    const menuGroups = NAV_GROUPS;
    const systemTabs = SYSTEM_TABS.filter(tab => canView(tab.perms));

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
            className={() => `relative w-full flex items-center py-2.5 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${isSidebarOpen ? 'pl-6 pr-3 gap-2.5' : 'justify-center px-0'
                } ${isItemActive(item)
                    ? 'bg-primary text-white font-bold shadow-md shadow-primary/25 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-1 before:rounded-r-full before:bg-white/80'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary dark:hover:text-white group font-semibold'
                }`}
        >
            {() => (
                <>
                    <Icon name={item.icon} size={18} className="flex-shrink-0" />
                    {isSidebarOpen && <span className="text-[13.5px] truncate animate-fade-in tracking-tight">{item.label}</span>}
                </>
            )}
        </NavLink>
    );

    return (
        <aside className={`
            fixed md:relative top-0 left-0 bottom-0 z-40
            flex-shrink-0 border-r-2 border-slate-200/90 dark:border-slate-700 flex flex-col h-full shadow-2xl md:shadow-[2px_0_12px_-4px_rgba(15,23,42,0.10)] transition-all duration-300 ease-in-out
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
                    <Icon name={isSidebarOpen ? 'chevron_left' : 'chevron_right'} size={16} />
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
                            <Icon name={currentTheme.logo_icon} size={24} />
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
                    const hasActiveChild = group.items.some(isItemActive);

                    return (
                        <div key={group.key} className="mb-1">
                            {/* Group Header */}
                            {isSidebarOpen ? (
                                <button
                                    onClick={() => toggleGroup(group.key)}
                                    aria-expanded={!isCollapsed}
                                    aria-controls={`nav-group-${group.key}`}
                                    aria-label={`${isCollapsed ? 'Mở rộng' : 'Thu gọn'} ${group.label}`}
                                    className={`w-full flex items-center justify-between px-3 pt-6 pb-2 mb-1 text-xs font-black uppercase tracking-widest transition-colors cursor-pointer outline-none opacity-90 hover:opacity-100 ${
                                        hasActiveChild
                                            ? (GROUP_TONE_ACTIVE[group.key] || 'text-primary')
                                            : (GROUP_TONE[group.key] || 'text-slate-500 dark:text-slate-400')
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Icon name={group.icon} size={20} />
                                        <span className="mt-0.5">{group.label}</span>
                                    </div>
                                    <Icon name="expand_more" size={16} className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
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
            {systemTabs.length > 0 && (
                <div className={`border-t border-slate-100 dark:border-slate-700/50 pt-2 pb-3 mb-1 ${isSidebarOpen ? 'px-3' : 'px-2'}`}>
                    {isSidebarOpen ? (
                        <button
                            onClick={() => toggleGroup('system')}
                            aria-expanded={!collapsed['system']}
                            className={`w-full flex items-center justify-between px-3 pt-4 pb-2 mb-1 text-xs font-black uppercase tracking-widest transition-colors cursor-pointer outline-none opacity-90 hover:opacity-100 ${
                                systemTabs.some(isItemActive) ? GROUP_TONE_ACTIVE.system : GROUP_TONE.system
                            }`}
                        >
                            <div className="flex items-center gap-2.5">
                                <Icon name="admin_panel_settings" size={20} />
                                <span className="mt-0.5">Hệ Thống</span>
                            </div>
                            <Icon name="expand_more" size={16} className={`transition-transform ${collapsed['system'] ? '-rotate-90' : ''}`} />
                        </button>
                    ) : (
                        <div className="w-full flex justify-center py-2 mb-1">
                            <div className="w-5 h-px bg-slate-200 dark:bg-slate-700 rounded-full" />
                        </div>
                    )}
                    
                    {(!collapsed['system'] || !isSidebarOpen) && (
                        <div className="space-y-0.5 max-h-[30vh] overflow-y-auto no-scrollbar">
                            {systemTabs.map(item => (
                                <NavItem key={item.id} item={item} />
                            ))}
                        </div>
                    )}
                </div>
            )}

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
                                <Icon name="logout" size={18} />
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

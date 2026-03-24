import { useAuth } from '../context/AuthContext';
import { currentTheme } from '../config/brand';

export default function Sidebar({ activeTab, setActiveTab, isSidebarOpen = true, setIsSidebarOpen }) {
    const { profile, hasPermission, logout } = useAuth();
    
    // Admin always has full access to all tabs. Otherwise, check permissions.
    const canView = (perms) => {
        if (!perms || perms.length === 0) return true; // Public tab
        // If user is Admin, they can see everything
        if (profile?.role_code === 'ROLE01' || profile?.role_code === 'ADMIN') return true;
        
        return perms.some(p => hasPermission(p));
    };

    const tabs = [
        { id: 'dashboard', icon: 'grid_view', label: 'Tổng quan', perms: ['view_dashboard'] },
        { id: 'contracts', icon: 'description', label: 'Hợp đồng', perms: ['view_contracts', 'create_contracts', 'edit_contracts', 'delete_contracts'] },
        { id: 'doc_tracking', icon: 'folder_managed', label: 'Hồ sơ & Thanh toán', perms: ['view_payments', 'create_payments', 'edit_payments', 'delete_payments'] },
        { id: 'payment_receipts', icon: 'receipt_long', label: 'Lịch sử thu tiền', perms: ['view_payments'] },
        { id: 'warranty_tracking', icon: 'security', label: 'Theo dõi Bảo hành', perms: ['view_contracts'] },
        { id: 'suppliers', icon: 'local_shipping', label: 'Nhà cung cấp', perms: ['view_partners', 'manage_partners'] },
        { id: 'subcontractors', icon: 'groups', label: 'Nhà thầu phụ / Tổ đội', perms: ['view_partners', 'manage_partners'] },
        { id: 'planning_hub', icon: 'analytics', label: 'Kế hoạch & Báo cáo', perms: ['view_planning', 'manage_planning'] },
        { id: 'inventory', icon: 'warehouse', label: 'Kho vật tư', perms: ['view_inventory', 'import_inventory', 'export_inventory', 'manage_materials'] },
        { id: 'construction', icon: 'engineering', label: 'Thi công', perms: ['view_construction', 'manage_construction'] },
    ].filter(tab => canView(tab.perms));

    const systemTabs = [
        { id: 'partners', icon: 'handshake', label: 'Danh mục Dự án / Khác', perms: ['manage_users'] },
        { id: 'materials', icon: 'inventory_2', label: 'Danh mục Vật tư', perms: ['manage_materials', 'view_inventory'] },
        { id: 'settings', icon: 'settings', label: 'Cài đặt', perms: ['manage_users', 'manage_settings'] },
        { id: 'permissions', icon: 'admin_panel_settings', label: 'Quản lý Phân quyền', perms: ['manage_users'] },
        { id: 'users', icon: 'person', label: 'Quản lý Người dùng', perms: ['manage_users'] },
    ].filter(tab => canView(tab.perms));

    return (
        <aside className={`
            fixed md:relative top-0 left-0 bottom-0 z-40
            flex-shrink-0 border-r border-slate-200 dark:border-slate-700 flex flex-col h-full shadow-2xl md:shadow-sm transition-all duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 w-64 md:w-20'}
        `} style={{ backgroundColor: 'var(--bg-sidebar-light)' }}>
            <style>{`.dark aside { background-color: var(--bg-sidebar-dark) !important; }`}</style>

            {/* Collapse Toggle Button (Hidden on Mobile) */}
            {setIsSidebarOpen && (
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
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

            <nav className={`flex-1 overflow-y-auto py-6 space-y-1 ${isSidebarOpen ? 'px-4' : 'px-2'}`}>
                {tabs.map(item => (
                    <button
                        key={item.id}
                        onClick={() => {
                            setActiveTab(item.id);
                            if (window.innerWidth < 768) setIsSidebarOpen(false);
                        }}
                        title={!isSidebarOpen ? item.label : undefined}
                        className={`w-full flex items-center py-2.5 rounded-lg transition-all mb-1 ${isSidebarOpen ? 'px-3 gap-3' : 'justify-center px-0'
                            } ${activeTab === item.id
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white group font-medium'
                            }`}
                    >
                        <span className={`material-symbols-outlined text-[20px] flex-shrink-0 ${activeTab === item.id ? 'filled' : ''}`}>{item.icon}</span>
                        {isSidebarOpen && <span className="text-sm truncate animate-fade-in">{item.label}</span>}
                    </button>
                ))}
            </nav>

            {/* System / Administration Section */}
            <div className={`border-t border-slate-100 dark:border-slate-700/50 py-4 space-y-1 ${isSidebarOpen ? 'px-4' : 'px-2'}`}>
                {isSidebarOpen && <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Hệ Thống</p>}
                {systemTabs.map(item => (
                    <button
                        key={item.id}
                        onClick={() => {
                            setActiveTab(item.id);
                            if (window.innerWidth < 768) setIsSidebarOpen(false);
                        }}
                        title={!isSidebarOpen ? item.label : undefined}
                        className={`w-full flex items-center py-2.5 rounded-lg transition-all mb-1 ${isSidebarOpen ? 'px-3 gap-3' : 'justify-center px-0'
                            } ${activeTab === item.id
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white group font-medium'
                            }`}
                    >
                        <span className={`material-symbols-outlined text-[20px] flex-shrink-0 ${activeTab === item.id ? 'filled' : ''}`}>{item.icon}</span>
                        {isSidebarOpen && <span className="text-sm truncate animate-fade-in">{item.label}</span>}
                    </button>
                ))}

            </div>

            <div className={`pb-4 ${isSidebarOpen ? 'px-4' : 'px-2'}`}>
                <div className={`mt-2 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center ${isSidebarOpen ? 'gap-3 px-1' : 'flex-col gap-3 justify-center'}`}>
                    <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center flex-shrink-0" style={{ backgroundImage: profile?.avatar_url ? `url('${profile.avatar_url}')` : "url('https://api.dicebear.com/7.x/avataaars/svg?seed=Felix')" }}></div>
                    {isSidebarOpen ? (
                        <>
                            <div className="flex flex-col overflow-hidden text-left flex-1 animate-fade-in">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{profile?.full_name || 'Người dùng'}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{profile?.roles?.name || profile?.role_code || 'GUEST'}</p>
                            </div>
                            <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0 ml-auto" title="Đăng xuất">
                                <span className="material-symbols-outlined notranslate text-[18px]" translate="no">logout</span>
                            </button>
                        </>
                    ) : (
                        <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0" title="Đăng xuất">
                            <span className="material-symbols-outlined notranslate text-[18px]" translate="no">logout</span>
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
}

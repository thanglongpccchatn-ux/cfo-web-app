import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardOverview from './components/DashboardOverview';
import ContractCreate from './components/ContractCreate';
import PaymentTracking from './components/PaymentTracking';
import MaterialTracking from './components/MaterialTracking';
import LaborTracking from './components/LaborTracking';
import AddendaCreate from './components/AddendaCreate';
import ContractMasterDetail from './components/ContractMasterDetail';
import PaymentsMaster from './components/PaymentsMaster';
import SuppliersMaster from './components/SuppliersMaster';
import SubcontractorsMaster from './components/SubcontractorsMaster';
import MaterialsMaster from './components/MaterialsMaster';
import PartnerManagement from './components/PartnerManagement';
import UserManagement from './components/UserManagement';
import RoleManagement from './components/RoleManagement';
import BankManagement from './components/BankManagement';
import PlanActualDashboard from './components/PlanActualDashboard';
import DocumentTrackingModule from './components/DocumentTrackingModule';
import PaymentReceiptsModule from './components/PaymentReceiptsModule';
import MonthlyReport from './components/MonthlyReport';
import ExpenseTracking from './components/ExpenseTracking';
import WarrantyTracking from './components/WarrantyTracking';
import PlanningModule from './components/PlanningModule';
import InventoryManager from './components/Inventory/InventoryManager';
import { InventoryProvider } from './context/InventoryContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Login from './components/Login';
import Settings from './components/Settings';
import UserProfile from './components/UserProfile';
import { applyBrandTheme, currentTheme } from './config/brand';
import { supabase } from './lib/supabase';

// Premium Coming Soon Component
function ComingSoon({ title = 'Module' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-blue-500/20 blur-[80px] rounded-full"></div>
        <div className="relative bg-white/50 dark:bg-slate-800/40 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 p-10 rounded-[40px] shadow-2xl animate-float">
          <span className="material-symbols-outlined notranslate text-7xl bg-gradient-to-br from-blue-500 to-indigo-600 bg-clip-text text-transparent" translate="no">construction</span>
        </div>
        <div className="absolute -bottom-4 -right-4 bg-yellow-400 text-slate-900 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-tighter shadow-lg rotate-12">
          Under Dev
        </div>
      </div>

      <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-4 tracking-tight">
        {title}
      </h3>

      <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto leading-relaxed font-medium">
        Chúng tôi đang nỗ lực hoàn thiện module <span className="text-blue-500 font-bold">{title}</span> để mang lại trải nghiệm quản trị tài chính tốt nhất cho bạn.
      </p>

      <div className="mt-12 flex flex-col items-center gap-6">
        <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/30">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-300 dark:bg-slate-700 flex items-center justify-center text-[8px] font-bold">AI</div>
            ))}
          </div>
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Team Sateco đang xử lý...</span>
        </div>

        <div className="animate-pulse flex items-center gap-2 text-blue-500 font-black text-[10px] uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          Dự kiến ra mắt: Q2 2026
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading, hasPermission, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [fullscreenView, setFullscreenView] = useState({ type: null, data: null });
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const { data, error } = await supabase.from('theme_settings').select('*').limit(1).maybeSingle();
        if (data) {
          applyBrandTheme(data);
        } else {
          applyBrandTheme(null);
        }
      } catch (err) {
        applyBrandTheme(null);
      }
      setThemeLoaded(true);
    };
    loadTheme();
  }, []);

  if (loading || !themeLoaded) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Full-screen takeovers
  if (fullscreenView.type === 'contract_form' || fullscreenView.type === 'contract_new') {
    return <ContractCreate project={fullscreenView.data} onBack={() => setFullscreenView({ type: null, data: null })} />;
  }
  if (fullscreenView.type === 'payment_tracking') {
    return <PaymentTracking project={fullscreenView.data} onBack={() => setFullscreenView({ type: null, data: null })} />;
  }
  if (fullscreenView.type === 'material_tracking') {
    return <MaterialTracking project={fullscreenView.data} onBack={() => setFullscreenView({ type: null, data: null })} />;
  }
  if (fullscreenView.type === 'labor_tracking') {
    return <LaborTracking project={fullscreenView.data} onBack={() => setFullscreenView({ type: null, data: null })} />;
  }
  if (fullscreenView.type === 'addenda_new') {
    return <AddendaCreate project={fullscreenView.data} onBack={() => setFullscreenView({ type: null, data: null })} />;
  }

  // Regular routing
  const renderContent = () => {
    const isAdmin = profile?.role_code === 'ROLE01' || profile?.role_code === 'ADMIN';
    switch (activeTab) {
      case 'dashboard':
        return (hasPermission('view_dashboard') || isAdmin) ? <DashboardOverview /> : (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">gpp_maybe</span>
                <h3 className="text-xl font-bold text-slate-700">Không có quyền truy cập</h3>
                <p className="text-slate-500 mt-2">Tài khoản của bạn không được cấp quyền xem Tổng quan.<br/>Vui lòng chọn chức năng khác ở menu bên trái.</p>
            </div>
        );
      case 'contracts':
        return (hasPermission('view_contracts') || isAdmin) ? <ContractMasterDetail onOpenFullscreen={(type, data) => setFullscreenView({ type, data })} /> : null;
      case 'doc_tracking':
        return (hasPermission('view_payments') || isAdmin) ? <DocumentTrackingModule /> : null;
      case 'payment_receipts':
        return (hasPermission('view_payments') || isAdmin) ? <PaymentReceiptsModule /> : null;
      case 'warranty_tracking':
        return (hasPermission('view_contracts') || isAdmin) ? <WarrantyTracking /> : null;
      case 'payments':
        return <PaymentsMaster />;
      case 'suppliers':
        return <SuppliersMaster />;
      case 'subcontractors':
        return <SubcontractorsMaster />;
      case 'materials':
        return <MaterialsMaster />;
      case 'inventory':
        return <InventoryManager />;
      case 'planning_hub':
        return <PlanningModule />;
      case 'construction':
        return <ComingSoon title="Thi công" />;
      case 'partners':
        return <PartnerManagement />;
      case 'permissions':
        return <RoleManagement />;
      case 'users':
        return <UserManagement />;
      case 'banks':
        return <BankManagement />;
      case 'settings':
        return <Settings />;
      case 'profile':
        return <UserProfile />;
      default:
        return <ComingSoon title="Module này" />;
    }
  };

  return (
    <ToastProvider>
      <InventoryProvider>
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans relative">
          
          {/* Mobile Sidebar Backdrop */}
          {isSidebarOpen && (
            <div 
              className="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 transition-opacity"
              onClick={() => setIsSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
          />

          <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-[#111827]">
            <Header
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
              setActiveTab={setActiveTab}
              title={
                activeTab === 'dashboard' ? 'Tổng quan Dòng tiền' :
                  activeTab === 'contracts' ? 'Quản lý Hợp đồng' :
                    activeTab === 'doc_tracking' ? 'Hồ sơ & Thanh toán' :
                      activeTab === 'payment_receipts' ? 'Lịch sử thu tiền' :
                        activeTab === 'suppliers' ? 'Nhà cung cấp' :
                          activeTab === 'subcontractors' ? 'Nhà thầu phụ / Tổ đội' :
                            activeTab === 'planning_hub' ? 'Kế hoạch & Báo cáo' :
                              activeTab === 'inventory' ? 'Kho vật tư' :
                                activeTab === 'settings' ? 'Cài đặt hệ thống' :
                                  activeTab === 'permissions' ? 'Phân quyền rủi ro' :
                                    activeTab === 'users' ? 'Quản lý Người dùng' :
                                      activeTab === 'profile' ? 'Trang cá nhân' : 'Hệ thống Quản trị'
              }
              subtitle={activeTab === 'dashboard' ? "Chào mừng trở lại!" : activeTab === 'contracts' ? "Danh sách và chi tiết dự án" : activeTab === 'inventory' ? "Quản lý kho vật tư công trình" : `${currentTheme.company_name} ${currentTheme.sub_name}`}
              onAction={activeTab === 'contracts' ? () => setFullscreenView({ type: 'contract_new', data: null }) : null}
            />

            <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
              {renderContent()}
            </div>
          </main>
        </div>
      </InventoryProvider>
    </ToastProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;

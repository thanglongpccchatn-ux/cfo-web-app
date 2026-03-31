import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { InventoryProvider } from './context/InventoryContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Login from './components/Login';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import ModuleErrorBoundary from './components/common/ModuleErrorBoundary';
import { applyBrandTheme, currentTheme } from './config/brand';
import { supabase } from './lib/supabase';
import { EventBus } from './lib/eventBus';
import { Metrics } from './lib/metrics';
import { destroyAuditLogger } from './lib/auditLog';

// Lazy load components for code splitting & better initial load performance
const DashboardOverview = lazy(() => import('./components/DashboardOverview'));
const ContractCreate = lazy(() => import('./components/ContractCreate'));
const PaymentTracking = lazy(() => import('./components/PaymentTracking'));
const MaterialTracking = lazy(() => import('./components/MaterialTracking'));
const LaborTracking = lazy(() => import('./components/LaborTracking'));
const AddendaCreate = lazy(() => import('./components/AddendaCreate'));
const ContractMasterDetail = lazy(() => import('./components/ContractMasterDetail'));
const PaymentsMaster = lazy(() => import('./components/PaymentsMaster'));
const SuppliersMaster = lazy(() => import('./components/SuppliersMaster'));
const SubcontractorsMaster = lazy(() => import('./components/SubcontractorsMaster'));
const MaterialsMaster = lazy(() => import('./components/MaterialsMaster'));
const PartnerManagement = lazy(() => import('./components/PartnerManagement'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const RoleManagement = lazy(() => import('./components/RoleManagement'));
const BankManagement = lazy(() => import('./components/BankManagement'));
const TreasuryManagement = lazy(() => import('./components/TreasuryManagement'));
const DocumentTrackingModule = lazy(() => import('./components/DocumentTrackingModule'));
const PaymentReceiptsModule = lazy(() => import('./components/PaymentReceiptsModule'));
const WarrantyTracking = lazy(() => import('./components/WarrantyTracking'));
const PlanningModule = lazy(() => import('./components/PlanningModule'));
const InventoryManager = lazy(() => import('./components/Inventory/InventoryManager'));
const Settings = lazy(() => import('./components/Settings'));
const UserProfile = lazy(() => import('./components/UserProfile'));
const SiteDiary = lazy(() => import('./components/SiteDiary'));
const SettlementManagement = lazy(() => import('./components/SettlementManagement'));
const VariationsManagement = lazy(() => import('./components/VariationsManagement'));
const BiddingManagement = lazy(() => import('./components/BiddingManagement'));
const ExpenseTracking = lazy(() => import('./components/ExpenseTracking'));
const ConstructionModule = lazy(() => import('./components/ConstructionModule'));
const UserGuide = lazy(() => import('./components/UserGuide'));
const LoanManagement = lazy(() => import('./components/LoanManagement'));
const AuditTrailViewer = lazy(() => import('./components/AuditTrailViewer'));

const queryClient = new QueryClient();

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
      <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-4 tracking-tight">{title}</h3>
      <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto leading-relaxed font-medium">
        Chúng tôi đang nỗ lực hoàn thiện module <span className="text-blue-500 font-bold">{title}</span> để mang lại trải nghiệm quản trị tài chính tốt nhất cho bạn.
      </p>
      <div className="mt-12 flex flex-col items-center gap-6">
        <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/30">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Team Sateco đang xử lý...</span>
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center h-full w-full min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}

function ProtectedRoute({ children, requiredPerms = [], moduleName }) {
  const { user, hasPermission, profile, loading } = useAuth();
  const location = useLocation();
  
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  const isAdmin = profile?.role_code === 'ROLE01' || profile?.role_code === 'ADMIN';
  if (isAdmin || requiredPerms.length === 0 || requiredPerms.some(p => hasPermission(p))) {
    const name = moduleName || location.pathname.substring(1).replace(/_/g, ' ') || 'Module';
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <ModuleErrorBoundary moduleName={name} key={location.pathname}>
          {children}
        </ModuleErrorBoundary>
      </Suspense>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">gpp_maybe</span>
      <h3 className="text-xl font-bold text-slate-700">Không có quyền truy cập</h3>
      <p className="text-slate-500 mt-2">Tài khoản của bạn không được cấp quyền xem phân hệ này.</p>
    </div>
  );
}

function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const location = useLocation();
  const path = location.pathname.substring(1) || 'dashboard';
  const [fullscreenView, setFullscreenView] = useState({ type: null, data: null });

  // Handle Header titles based on current route
  const getHeaderInfo = () => {
    switch (path) {
      case 'dashboard': return { title: 'Tổng quan Dòng tiền', subtitle: 'Chào mừng trở lại!' };
      case 'contracts': return { title: 'Quản lý Hợp đồng', subtitle: 'Danh sách và chi tiết dự án' };
      case 'doc_tracking': return { title: 'Hồ sơ & Thanh toán', subtitle: `${currentTheme.company_name}` };
      case 'payment_receipts': return { title: 'Lịch sử thu tiền', subtitle: `${currentTheme.company_name}` };
      case 'suppliers': return { title: 'Nhà cung cấp & Vật tư', subtitle: 'Theo dõi đối tác và nhật ký nhập vật tư' };
      case 'subcontractors': return { title: 'Nhà thầu phụ / Tổ đội', subtitle: 'Bảng theo dõi công nợ thầu phụ' };
      case 'materials': return { title: 'Danh mục Vật tư', subtitle: 'Quản lý danh pháp vật tư chung' };
      case 'planning_hub': return { title: 'Kế hoạch & Báo cáo', subtitle: 'Kế hoạch dòng tiền tạm tính' };
      case 'inventory': return { title: 'Kho vật tư', subtitle: 'Quản lý kho vật tư công trình' };
      case 'settings': return { title: 'Cài đặt hệ thống', subtitle: 'Cấu hình giao diện và thông số chung' };
      case 'permissions': return { title: 'Phân quyền rủi ro', subtitle: 'Cấu hình quyền hệ thống' };
      case 'users': return { title: 'Quản lý Người dùng', subtitle: 'Quản lý và kích hoạt tài khoản' };
      case 'profile': return { title: 'Trang cá nhân', subtitle: 'Thông tin hồ sơ và mật khẩu' };
      case 'site_diary': return { title: 'Nhật ký hiện trường', subtitle: 'Báo cáo hoạt động thi công hàng ngày' };
      case 'settlement': return { title: 'Quản lý Quyết Toán', subtitle: 'Theo dõi quyết toán, công nợ và hồ sơ pháp lý' };
      case 'bidding': return { title: 'Theo dõi Báo giá / Đấu thầu', subtitle: 'Quản lý vòng đời đấu thầu và phiên bản báo giá' };
      case 'labor_tracking': return { title: 'Theo dõi Nhân công', subtitle: 'Chi phí thầu phụ và nhân công' };
      case 'material_tracking': return { title: 'Theo dõi Vật tư', subtitle: 'Chi phí vật tư hiện trường' };
      case 'expense_tracking': return { title: 'Chi phí Chung', subtitle: 'Quản lý chi phí vận hành & văn phòng' };
      case 'guide': return { title: 'Hướng dẫn sử dụng', subtitle: 'Hướng dẫn chi tiết cho từng vai trò' };
      case 'loans': return { title: 'Quản lý Vay vốn', subtitle: 'Theo dõi khoản vay, lãi suất và trịch sử trả nợ' };
      case 'audit_trail': return { title: 'Nhật ký Hoạt động', subtitle: 'Lịch sử mọi thao tác trong hệ thống' };
      default: return { title: 'Hệ thống Quản trị', subtitle: `${currentTheme.company_name}` };
    }
  };

  const { title, subtitle } = getHeaderInfo();

  // Full-screen takeovers (kept for complex sub-flows)
  if (fullscreenView.type === 'contract_form' || fullscreenView.type === 'contract_new') {
    return <Suspense fallback={<LoadingSpinner />}><ContractCreate project={fullscreenView.data} onBack={() => setFullscreenView({ type: null, data: null })} /></Suspense>;
  }
  if (fullscreenView.type === 'payment_tracking') {
    return <Suspense fallback={<LoadingSpinner />}><PaymentTracking project={fullscreenView.data} onBack={() => setFullscreenView({ type: null, data: null })} /></Suspense>;
  }
  if (fullscreenView.type === 'material_tracking') {
    return <Suspense fallback={<LoadingSpinner />}><MaterialTracking project={fullscreenView.data} onBack={() => setFullscreenView({ type: null, data: null })} /></Suspense>;
  }
  if (fullscreenView.type === 'labor_tracking') {
    return <Suspense fallback={<LoadingSpinner />}><LaborTracking project={fullscreenView.data} onBack={() => setFullscreenView({ type: null, data: null })} /></Suspense>;
  }
  if (fullscreenView.type === 'addenda_new') {
    return <Suspense fallback={<LoadingSpinner />}><AddendaCreate project={fullscreenView.data} onBack={() => setFullscreenView({ type: null, data: null })} /></Suspense>;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans relative">
      <a href="#main-content" className="skip-to-content">Bỏ qua đến nội dung chính</a>
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-[#111827]">
        <Header
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          title={title}
          subtitle={subtitle}
        />

        <div id="main-content" role="main" className="flex-1 overflow-y-auto p-3 md:p-6 scroll-smooth">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Core Modules */}
            <Route path="/dashboard" element={<ProtectedRoute requiredPerms={['view_dashboard']}><DashboardOverview /></ProtectedRoute>} />
            <Route path="/contracts" element={<ProtectedRoute requiredPerms={['view_contracts']}><ContractMasterDetail onOpenFullscreen={(type, data) => setFullscreenView({ type, data })} /></ProtectedRoute>} />
            <Route path="/bidding" element={<ProtectedRoute requiredPerms={['view_bids']}><BiddingManagement /></ProtectedRoute>} />
            <Route path="/variations" element={<ProtectedRoute requiredPerms={['view_contracts']}><VariationsManagement /></ProtectedRoute>} />
            <Route path="/doc_tracking" element={<ProtectedRoute requiredPerms={['view_payments']}><DocumentTrackingModule /></ProtectedRoute>} />
            <Route path="/payment_receipts" element={<ProtectedRoute requiredPerms={['view_payments']}><PaymentReceiptsModule /></ProtectedRoute>} />
            <Route path="/site_diary" element={<ProtectedRoute><SiteDiary /></ProtectedRoute>} />
            <Route path="/warranty_tracking" element={<ProtectedRoute requiredPerms={['view_contracts']}><WarrantyTracking /></ProtectedRoute>} />
            <Route path="/settlement" element={<ProtectedRoute requiredPerms={['view_contracts']}><SettlementManagement /></ProtectedRoute>} />
            <Route path="/labor_tracking" element={<ProtectedRoute requiredPerms={['view_payments']}><LaborTracking /></ProtectedRoute>} />
            <Route path="/material_tracking" element={<ProtectedRoute requiredPerms={['view_payments']}><MaterialTracking /></ProtectedRoute>} />
            <Route path="/expense_tracking" element={<ProtectedRoute requiredPerms={['view_payments']}><ExpenseTracking /></ProtectedRoute>} />
            
            {/* Financial & Inventory Modules */}
            <Route path="/payments" element={<ProtectedRoute requiredPerms={['view_payments']}><PaymentsMaster /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute requiredPerms={['view_suppliers', 'view_payments']}><SuppliersMaster /></ProtectedRoute>} />
            <Route path="/subcontractors" element={<ProtectedRoute requiredPerms={['view_suppliers', 'view_payments']}><SubcontractorsMaster /></ProtectedRoute>} />
            <Route path="/materials" element={<ProtectedRoute requiredPerms={['view_materials', 'view_payments']}><MaterialsMaster /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute requiredPerms={['view_materials']}><InventoryManager /></ProtectedRoute>} />
            
            {/* Other Modules */}
            <Route path="/planning_hub" element={<ProtectedRoute><PlanningModule /></ProtectedRoute>} />
            <Route path="/construction" element={<ProtectedRoute><ConstructionModule /></ProtectedRoute>} />
            <Route path="/partners" element={<ProtectedRoute><PartnerManagement /></ProtectedRoute>} />
            <Route path="/permissions" element={<ProtectedRoute><RoleManagement /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/banks" element={<ProtectedRoute><BankManagement /></ProtectedRoute>} />
            <Route path="/treasury" element={<ProtectedRoute requiredPermission={['manage_treasury', '*']}><TreasuryManagement /></ProtectedRoute>} />
            
            {/* App Settings */}
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/guide" element={<ProtectedRoute><UserGuide /></ProtectedRoute>} />
            <Route path="/loans" element={<ProtectedRoute requiredPerms={['view_loans']}><LoanManagement /></ProtectedRoute>} />
            <Route path="/audit_trail" element={<ProtectedRoute requiredPerms={['manage_users']}><AuditTrailViewer /></ProtectedRoute>} />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function AppContent() {
  const { user, loading, logout } = useAuth();
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    // 12-second global loading timeout
    const timer = setTimeout(() => {
      if (loading || !themeLoaded) {
        setLoadingTimeout(true);
      }
    }, 12000);

    return () => clearTimeout(timer);
  }, [loading, themeLoaded]);

  // Initialize EventBus realtime bridge & cleanup on unmount
  useEffect(() => {
    EventBus.initRealtimeBridge();
    return () => {
      EventBus.destroy();
      Metrics.destroy();
      destroyAuditLogger();
    };
  }, []);

  useEffect(() => {
    const loadTheme = async () => {
      // Safety timeout for theme loading (6 seconds)
      const themeTimeout = setTimeout(() => {
        applyBrandTheme(null);
        setThemeLoaded(true);
      }, 6000);

      try {
        const { data } = await supabase.from('theme_settings').select('*').limit(1).maybeSingle();
        applyBrandTheme(data || null);
      } catch {
        applyBrandTheme(null);
      } finally {
        clearTimeout(themeTimeout);
        setThemeLoaded(true);
      }
    };

    loadTheme();
  }, []); // Run only once on mount

  if (loadingTimeout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 p-6 text-center">
        <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center text-rose-600 mb-6">
          <span className="material-symbols-outlined text-4xl">cloud_off</span>
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Kết nối quá lâu</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8">
          Ứng dụng đang mất nhiều thời gian hơn dự kiến để khởi tạo. Điều này có thể do kết nối mạng hoặc cấu hình hệ thống.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all"
          >
            Thử tải lại trang
          </button>
          <button 
            onClick={logout} 
            className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50 transition-all"
          >
            Đăng xuất & Xóa Cache
          </button>
        </div>
      </div>
    );
  }

  if (loading || !themeLoaded) return <LoadingSpinner />;
  if (!user) return <Login />;
  
  return (
    <NotificationProvider>
      <ToastProvider>
        <InventoryProvider>
          <MainLayout />
        </InventoryProvider>
      </ToastProvider>
    </NotificationProvider>
  );
}

function App() {
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}

export default App;

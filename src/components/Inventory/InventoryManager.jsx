import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import InventoryDashboard from './InventoryDashboard';
import InventoryList from './InventoryList';
import InventoryInbound from './InventoryInbound';
import InventoryOutbound from './InventoryOutbound';
import InventoryRequestForm from './InventoryRequestForm';
import InventoryRequestList from './InventoryRequestList';

class InventoryErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px' }}>
          <h2>Inventory Module Crashed!</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>Click to show error details</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function InventoryManager() {
    const [subTab, setSubTab] = useState('overview'); // overview, stock, inbound, outbound, requests
    const { loading } = useInventory();
    const { hasPermission, profile } = useAuth();

    const tabs = [
        { id: 'overview', label: 'Tổng quan', icon: 'dashboard', perm: 'view_inventory' },
        { id: 'stock', label: 'Kho vật tư', icon: 'inventory_2', perm: 'view_inventory' },
        { id: 'inbound', label: 'Nhập kho', icon: 'login', perm: 'import_inventory' },
        { id: 'outbound', label: 'Xuất kho', icon: 'logout', perm: 'export_inventory' },
        { id: 'requests', label: 'Yêu cầu', icon: 'assignment', perm: 'view_inventory' }
    ].filter(t => !t.perm || hasPermission(t.perm) || profile?.role_code === 'ROLE01');

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full animate-pulse"></div>
                    <div className="relative w-12 h-12 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="mt-6 text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] animate-pulse text-center">
                    Đang đồng bộ dữ liệu kho...
                </p>
            </div>
        );
    }

    const renderSubContent = () => {
        switch (subTab) {
            case 'overview': return <InventoryDashboard onAction={(tab) => setSubTab(tab)} />;
            case 'stock': return <InventoryList onAction={(tab) => setSubTab(tab)} />;
            case 'inbound': return <InventoryInbound onBack={() => setSubTab('stock')} />;
            case 'outbound': return <InventoryOutbound onBack={() => setSubTab('stock')} />;
            case 'requests': return <InventoryRequestList onCreateNew={() => setSubTab('request_form')} />;
            case 'request_form': return <InventoryRequestForm onBack={() => setSubTab('requests')} />;
            default: return <InventoryDashboard onAction={(tab) => setSubTab(tab)} />;
        }
    };

    return (
        <InventoryErrorBoundary>
        <div className="h-full flex flex-col space-y-6 animate-fade-in">
            {/* Sub-navigation Premium */}
            <div className="flex items-center justify-between px-2">
                <div className="flex gap-1.5 bg-slate-200/50 dark:bg-slate-900/50 p-1.5 rounded-[24px] backdrop-blur-xl border border-white/20 dark:border-slate-800/50 shadow-inner">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSubTab(tab.id)}
                            className={`
                                px-6 py-2.5 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2.5
                                ${subTab === tab.id 
                                    ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-xl shadow-blue-500/10 scale-100 ring-1 ring-slate-200/50 dark:ring-slate-700/50' 
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-300/30 font-bold'}
                            `}
                        >
                            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                            <span className="hidden md:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
                
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-500 rounded-2xl border border-blue-500/20">
                    <span className="text-[10px] font-black uppercase tracking-widest">WMS v2.0</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar animate-slide-in relative">
                {renderSubContent()}
            </div>
        </div>
        </InventoryErrorBoundary>
    );
}

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import ProjectStock from './ProjectStock';
import MaterialRequest from './MaterialRequest';
import MaterialIssue from './MaterialIssue';
import IssueSlipList from './IssueSlipList';
import InventoryReport from './InventoryReport';

class InventoryErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('Inventory error', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40">
          <h3 className="font-black mb-1">Module Kho vật tư gặp lỗi</h3>
          <p className="text-sm">{this.state.error?.toString()}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function InventoryManager() {
  const [subTab, setSubTab] = useState('project_stock');
  const [issueRequest, setIssueRequest] = useState(null);
  const { hasPermission, profile } = useAuth();

  const tabs = [
    { id: 'project_stock', label: 'Tồn kho dự án', icon: 'inventory', perm: 'view_inventory' },
    { id: 'requests', label: 'Đề nghị VT', icon: 'assignment', perm: 'view_inventory' },
    { id: 'issue_slips', label: 'Phiếu xuất', icon: 'receipt_long', perm: 'view_inventory' },
    { id: 'report', label: 'Báo cáo NXT', icon: 'assessment', perm: 'view_inventory' },
  ].filter(t => !t.perm || hasPermission(t.perm) || profile?.role_code === 'ROLE01');

  const renderSubContent = () => {
    switch (subTab) {
      case 'project_stock': return <ProjectStock />;
      case 'requests': return <MaterialRequest onIssue={(r) => { setIssueRequest(r); setSubTab('issue'); }} />;
      case 'issue': return <MaterialIssue request={issueRequest} onBack={() => { setIssueRequest(null); setSubTab('requests'); }} />;
      case 'issue_slips': return <IssueSlipList />;
      case 'report': return <InventoryReport />;
      default: return <ProjectStock />;
    }
  };

  return (
    <InventoryErrorBoundary>
      <div className="h-full flex flex-col space-y-6 animate-fade-in">
        <div className="flex items-center justify-between px-2">
          <div className="flex gap-1.5 bg-slate-200/50 dark:bg-slate-900/50 p-1.5 rounded-[24px] backdrop-blur-xl border border-white/20 dark:border-slate-800/50 shadow-inner">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setSubTab(tab.id)}
                className={`px-6 py-2.5 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2.5 ${
                  (subTab === tab.id || (subTab === 'issue' && tab.id === 'requests'))
                    ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-xl shadow-blue-500/10 ring-1 ring-slate-200/50 dark:ring-slate-700/50'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-300/30 font-bold'}`}>
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-500 rounded-2xl border border-blue-500/20">
            <span className="text-[10px] font-black uppercase tracking-widest">Kho dự án</span>
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

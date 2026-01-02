import React, { useState, useEffect } from 'react';
import { 
  subscribeToCategories, 
  addSystemCategory, 
  deleteSystemCategory, 
  subscribeToAuditLogs, 
  logSystemAction,
  subscribeToAllExpenses,
  subscribeToAllCutoffs,
  subscribeToUsers,
  toggleUserLock,
  subscribeToAppeals,
  resolveAppeal
} from '../services/db';
import { Category, AuditLog, Expense, CutOff, UserMetadata, AccessAppeal } from '../types';
import { formatCurrency } from '../utils/security';
import { useAuth } from '../context/AuthContext';

export const AdminDashboard: React.FC = () => {
  const { user, reauthenticate } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'health' | 'governance' | 'audit' | 'users'>('overview');
  
  // Data State
  const [categories, setCategories] = useState<Category[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]); 
  
  // REAL-TIME ANALYTICS STATE
  const [globalExpenses, setGlobalExpenses] = useState<Expense[]>([]);
  const [globalCutoffs, setGlobalCutoffs] = useState<CutOff[]>([]);
  const [users, setUsers] = useState<UserMetadata[]>([]);
  const [appeals, setAppeals] = useState<AccessAppeal[]>([]); 
  
  const [newCategory, setNewCategory] = useState('');
  
  // UI State for Actions
  const [isDeploying, setIsDeploying] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  
  // MOCK SYSTEM HEALTH METRICS (Simulated for Thesis)
  const [serverLoad, setServerLoad] = useState(12);
  const [dbLatency, setDbLatency] = useState(45);
  const [encryptionOps, setEncryptionOps] = useState(1240);

  // SAFETY GUARD & CLEARANCE MODALS
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  
  // SECURITY OPS STATE
  const [securityAction, setSecurityAction] = useState<{ uid: string, currentLock: boolean } | null>(null);
  const [adminPass, setAdminPass] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // --- INITIALIZATION ---
  
  useEffect(() => {
    const unsubCat = subscribeToCategories(setCategories);
    const unsubLogs = subscribeToAuditLogs(setAuditLogs, setIsCloudConnected);
    const unsubExp = subscribeToAllExpenses(setGlobalExpenses);
    const unsubCut = subscribeToAllCutoffs(setGlobalCutoffs);
    const unsubUsers = subscribeToUsers(setUsers);
    const unsubAppeals = subscribeToAppeals(setAppeals);

    // Simulate Server Metrics ticking
    const interval = setInterval(() => {
        setServerLoad(prev => Math.max(5, Math.min(90, prev + (Math.random() > 0.5 ? 2 : -2))));
        setDbLatency(prev => Math.max(20, Math.min(150, prev + (Math.random() > 0.5 ? 5 : -5))));
        setEncryptionOps(prev => prev + Math.floor(Math.random() * 10));
    }, 2000);

    return () => {
        unsubCat();
        unsubLogs();
        unsubExp();
        unsubCut();
        unsubUsers();
        unsubAppeals();
        clearInterval(interval);
    };
  }, []);

  // --- DERIVED ANALYTICS ---
  const totalVolume = globalExpenses.reduce((acc, curr) => acc + (curr.decryptedAmount || 0), 0);
  const totalTransactions = globalExpenses.length;
  const pendingAppealsCount = appeals.filter(a => a.status === 'PENDING').length;
  const highValueTransactions = globalExpenses.filter(e => (e.decryptedAmount || 0) > 10000);

  // GLOBAL CATEGORY DISTRIBUTION
  const categoryStats: Record<string, number> = {};
  globalExpenses.forEach(e => {
      categoryStats[e.category] = (categoryStats[e.category] || 0) + (e.decryptedAmount || 0);
  });
  const sortedCategories = Object.entries(categoryStats).sort((a,b) => b[1] - a[1]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    const normalizedName = newCategory.trim().toLowerCase();
    const exists = categories.some(c => c.name.toLowerCase() === normalizedName);
    if (exists) { alert(`Validation Error: '${newCategory}' is already active.`); return; }
    setIsDeploying(true);
    try {
      await addSystemCategory(newCategory.trim(), user?.email || 'admin');
      setNewCategory(''); 
      if (!isCloudConnected) alert("Queued (Offline Mode)");
    } catch (err: any) { alert(err.message); } finally { setIsDeploying(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try { await deleteSystemCategory(deleteTargetId, user?.email || 'admin'); setDeleteTargetId(null); } catch (e: any) { alert(e.message); }
  };

  const handleManualTestLog = async () => {
      logSystemAction('admin@secure.com', 'MANUAL_TEST', 'Testing Cloud Write Capability', 'SUCCESS');
      alert("Test log dispatched.");
  };

  const handleExportLogs = () => {
    if (auditLogs.length === 0) { alert("No logs."); return; }
    const headers = "Timestamp,Actor,Action,Details,Status\n";
    const rows = auditLogs.map(log => {
        const time = log.timestamp?.toDate ? log.timestamp.toDate().toISOString() : new Date().toISOString();
        const safeDetails = log.details.replace(/,/g, ";"); 
        return `${time},${log.actor},${log.action},"${safeDetails}",${log.status}`;
    }).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + headers + rows;
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Security_Audit_Log.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString();
    } catch (e) { return 'Invalid Date'; }
  };

  // --- SECURITY ACTIONS ---
  const handleToggleLock = (uid: string, currentLock: boolean) => {
      if (uid === user?.uid) { alert("SECURITY PROTOCOL: You cannot lock your own administrative account."); return; }
      setSecurityAction({ uid, currentLock });
      setAdminPass('');
  };

  const executeSecurityAction = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!securityAction) return;
      setIsVerifying(true);
      try {
          await reauthenticate(adminPass);
          await toggleUserLock(securityAction.uid, securityAction.currentLock, user?.email || 'admin', user?.uid || '');
          if (securityAction.currentLock) {
             const userAppeals = appeals.filter(a => a.uid === securityAction.uid && a.status === 'PENDING');
             for (const app of userAppeals) { await resolveAppeal(app.id, 'APPROVED', user?.email || 'admin'); }
          }
          setSecurityAction(null); setAdminPass('');
      } catch (err: any) { alert(err.message); } finally { setIsVerifying(false); }
  };

  const handleRejectAppeal = async (appealId: string) => {
      try { await resolveAppeal(appealId, 'REJECTED', user?.email || 'admin'); } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      
      {/* 1. SAFETY GUARD (CATEGORY DELETION) */}
      {deleteTargetId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-red-500 animate-slide-up">
                  <h3 className="text-lg font-bold text-slate-800">Confirm Deletion</h3>
                  <p className="text-sm text-slate-500 mt-2">
                      Are you sure you want to remove this category? This action will be logged in the Security Audit Trail.
                  </p>
                  <div className="mt-6 flex gap-3">
                      <button 
                        onClick={() => setDeleteTargetId(null)}
                        className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={confirmDelete}
                        className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-lg"
                      >
                          Delete Securely
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* 2. SECURITY CLEARANCE MODAL (PASSWORD PROMPT) */}
      {securityAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md animate-fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-sm animate-slide-up">
                  <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-red-900/50 flex items-center justify-center border border-red-500 text-red-500">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-white">Security Clearance</h3>
                          <p className="text-xs text-slate-400">Step-Up Authentication Required</p>
                      </div>
                  </div>
                  
                  <p className="text-sm text-slate-300 mb-6">
                      You are about to <span className={securityAction.currentLock ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                          {securityAction.currentLock ? "UNLOCK" : "LOCK"}
                      </span> user access. Please verify your administrative credentials to proceed.
                  </p>
                  
                  <form onSubmit={executeSecurityAction}>
                      <input 
                         type="password"
                         required
                         autoFocus
                         placeholder="Enter Admin Password"
                         value={adminPass}
                         onChange={e => setAdminPass(e.target.value)}
                         className="w-full bg-black/30 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 outline-none mb-4"
                      />
                      <div className="flex gap-3">
                          <button 
                            type="button"
                            onClick={() => { setSecurityAction(null); setAdminPass(''); }}
                            className="flex-1 px-4 py-2 bg-slate-800 text-slate-400 font-medium rounded-lg hover:bg-slate-700 transition"
                          >
                              Abort
                          </button>
                          <button 
                            type="submit"
                            disabled={isVerifying}
                            className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-lg flex justify-center items-center"
                          >
                              {isVerifying ? 'Verifying...' : 'Authorize'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Header */}
      <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg flex justify-between items-center transition-all hover:shadow-2xl">
        <div>
          <h1 className="text-2xl font-bold tracking-wider">SECURITY OPERATIONS CENTER</h1>
          <p className="text-indigo-300 text-sm">System Administrator Console</p>
        </div>
        <div className="text-right space-y-2">
          <div className="text-xs text-slate-400 uppercase">System Status</div>
          <div className={`flex items-center font-bold text-sm ${isCloudConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${isCloudConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            {isCloudConnected ? 'CLOUD CONNECTED' : 'OFFLINE (LOCAL)'}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-white p-1 rounded-lg border border-slate-200 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`flex-1 min-w-[100px] py-2 text-sm font-medium rounded-md transition-all duration-300 ${activeTab === 'overview' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('health')}
          className={`flex-1 min-w-[100px] py-2 text-sm font-medium rounded-md transition-all duration-300 ${activeTab === 'health' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          System Health
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex-1 min-w-[100px] py-2 text-sm font-medium rounded-md transition-all duration-300 relative ${activeTab === 'users' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          User Security
          {pendingAppealsCount > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('governance')}
          className={`flex-1 min-w-[100px] py-2 text-sm font-medium rounded-md transition-all duration-300 ${activeTab === 'governance' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Governance
        </button>
        <button 
          onClick={() => setActiveTab('audit')}
          className={`flex-1 min-w-[100px] py-2 text-sm font-medium rounded-md transition-all duration-300 ${activeTab === 'audit' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Audit Logs
        </button>
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-slide-up">
            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                <p className="text-xs font-bold text-slate-400 uppercase">Total Encrypted Volume</p>
                <div className="text-2xl font-mono font-bold text-slate-800 mt-2">
                {formatCurrency(totalVolume)}
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                <p className="text-xs font-bold text-slate-400 uppercase">Transactions Logged</p>
                <div className="text-2xl font-mono font-bold text-indigo-600 mt-2">
                {totalTransactions}
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                <p className="text-xs font-bold text-slate-400 uppercase">Registered Tenants</p>
                <div className="text-2xl font-mono font-bold text-emerald-600 mt-2">
                {users.length}
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                <p className="text-xs font-bold text-slate-400 uppercase">Pending Appeals</p>
                <div className={`text-2xl font-mono font-bold mt-2 ${pendingAppealsCount > 0 ? 'text-orange-500' : 'text-slate-400'}`}>
                {pendingAppealsCount}
                </div>
            </div>
            </div>

            {/* ECONOMY STATS */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Global Economy Statistics</h3>
                <div className="space-y-4">
                    {sortedCategories.slice(0, 5).map(([cat, amount], idx) => {
                         const percentage = totalVolume > 0 ? (amount / totalVolume) * 100 : 0;
                         return (
                            <div key={cat}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-slate-700">{idx + 1}. {cat}</span>
                                    <span className="text-slate-500 font-mono">{formatCurrency(amount)} ({percentage.toFixed(1)}%)</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2">
                                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${percentage}%`}}></div>
                                </div>
                            </div>
                         );
                    })}
                </div>
            </div>
        </div>
      )}

      {/* TAB CONTENT: SYSTEM HEALTH */}
      {activeTab === 'health' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
              <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-700">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Real-Time Server Metrics
                  </h3>
                  
                  <div className="space-y-6">
                      <div>
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                              <span>CPU Load</span>
                              <span>{serverLoad}%</span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${serverLoad}%` }}></div>
                          </div>
                      </div>
                      
                      <div>
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                              <span>Database Latency</span>
                              <span className={dbLatency > 100 ? "text-red-400" : "text-emerald-400"}>{dbLatency}ms</span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div className={`h-full transition-all duration-500 ${dbLatency > 100 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${dbLatency / 2}%` }}></div>
                          </div>
                      </div>

                      <div>
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                              <span>Encryption Ops / sec</span>
                              <span>{encryptionOps}</span>
                          </div>
                           <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: '85%' }}></div>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Infrastructure Status</h3>
                  <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <span className="text-sm font-medium text-slate-600">Database Engine</span>
                          <span className="text-xs font-bold px-2 py-1 bg-green-100 text-green-700 rounded">Firestore (Active)</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <span className="text-sm font-medium text-slate-600">Encryption Standard</span>
                          <span className="text-xs font-bold px-2 py-1 bg-indigo-100 text-indigo-700 rounded">AES-256 (Sim)</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <span className="text-sm font-medium text-slate-600">Region</span>
                          <span className="text-xs font-bold px-2 py-1 bg-slate-200 text-slate-700 rounded">asia-southeast1</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <span className="text-sm font-medium text-slate-600">Total Uptime</span>
                          <span className="text-xs font-bold font-mono text-slate-700">99.99%</span>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* TAB CONTENT: USER OPS */}
      {activeTab === 'users' && (
          <div className="space-y-6 animate-slide-up">
            
             {/* APPEALS SECTION (If any) */}
             {pendingAppealsCount > 0 && (
                 <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                     <h3 className="font-bold text-orange-800 flex items-center gap-2">
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                         Pending Access Appeals
                     </h3>
                     <div className="mt-4 space-y-3">
                         {appeals.filter(a => a.status === 'PENDING').map(appeal => (
                             <div key={appeal.id} className="bg-white p-4 rounded-lg shadow-sm border border-orange-100 flex justify-between items-start">
                                 <div>
                                     <div className="text-sm font-bold text-slate-800">{appeal.email}</div>
                                     <div className="text-xs text-slate-500 mb-2">Requested: {new Date(appeal.timestamp).toLocaleString()}</div>
                                     <p className="text-sm text-slate-600 italic">"{appeal.reason}"</p>
                                 </div>
                                 <div className="flex gap-2">
                                     <button 
                                        onClick={() => handleRejectAppeal(appeal.id)}
                                        className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded hover:bg-slate-200"
                                     >
                                         Reject
                                     </button>
                                     <button 
                                        onClick={() => handleToggleLock(appeal.uid, true)} // True means "Currently Locked", so logic will Unlock
                                        className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 shadow-sm"
                                     >
                                         Approve & Unlock
                                     </button>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             )}

             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                 <h3 className="font-bold text-slate-800">User Security Management</h3>
                 <p className="text-xs text-slate-500">Monitor risk scores and enforce access controls.</p>
             </div>
             <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                     <thead className="bg-white text-slate-500 border-b">
                         <tr>
                             <th className="px-6 py-3">Tenant Identity</th>
                             <th className="px-6 py-3">Last Active</th>
                             <th className="px-6 py-3">Anomaly Score</th>
                             <th className="px-6 py-3">Access Status</th>
                             <th className="px-6 py-3 text-right">Admin Action</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                         {users.length === 0 && (
                             <tr><td colSpan={5} className="p-6 text-center text-slate-400 italic">No users registered in the system yet.</td></tr>
                         )}
                         {users.map(u => {
                             // Calculate dynamic risk score based on high value transactions for this user
                             const userAnomalies = globalExpenses.filter(e => e.userId === u.uid && (e.decryptedAmount || 0) > 10000).length;
                             const isHighRisk = userAnomalies > 2;
                             const isSelf = u.uid === user?.uid;
                             
                             return (
                                 <tr key={u.uid} className={u.isLocked ? "bg-red-50/50" : "hover:bg-slate-50"}>
                                     <td className="px-6 py-3">
                                         <div className="font-bold text-slate-700">{u.email} {isSelf && <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded">YOU</span>}</div>
                                         <div className="text-[10px] font-mono text-slate-400">{u.uid}</div>
                                     </td>
                                     <td className="px-6 py-3 text-slate-500">{formatTime(u.lastLogin)}</td>
                                     <td className="px-6 py-3">
                                         <span className={`px-2 py-1 rounded text-xs font-bold ${isHighRisk ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                             {userAnomalies} Detected
                                         </span>
                                     </td>
                                     <td className="px-6 py-3">
                                         {u.isLocked ? (
                                             <span className="flex items-center text-red-600 font-bold text-xs uppercase">
                                                 <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                 LOCKED
                                             </span>
                                         ) : (
                                             <span className="text-emerald-600 font-bold text-xs uppercase flex items-center">
                                                 <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                                                 ACTIVE
                                             </span>
                                         )}
                                     </td>
                                     <td className="px-6 py-3 text-right">
                                         {isSelf ? (
                                             <span className="text-xs text-slate-400 italic">Action Disabled</span>
                                         ) : (
                                            <button 
                                                onClick={() => handleToggleLock(u.uid, u.isLocked)}
                                                className={`px-3 py-1.5 rounded text-xs font-bold transition shadow-sm active:scale-95 ${u.isLocked ? 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50' : 'bg-red-600 text-white hover:bg-red-700'}`}
                                            >
                                                {u.isLocked ? 'UNLOCK ACCOUNT' : 'LOCK ACCOUNT'}
                                            </button>
                                         )}
                                     </td>
                                 </tr>
                             );
                         })}
                     </tbody>
                 </table>
             </div>
          </div>
          </div>
      )}

      {/* TAB CONTENT: GOVERNANCE (Categories) */}
      {activeTab === 'governance' && (
        <div className="bg-white rounded-xl shadow-lg border border-indigo-100 overflow-hidden animate-slide-up">
        <div className="p-6 bg-indigo-50 border-b border-indigo-100">
          <h3 className="font-bold text-indigo-900">Standardized Category Management</h3>
          <p className="text-xs text-indigo-600 mt-1">
             Enforce data consistency by defining global categories.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
           {/* Add New */}
           <div className="md:col-span-1 border-r border-slate-100 pr-4">
              <h4 className="text-sm font-bold text-slate-700 uppercase mb-3">Add Control</h4>
              <form onSubmit={handleAddCategory} className="space-y-3">
                 <input 
                   type="text" 
                   value={newCategory}
                   onChange={(e) => setNewCategory(e.target.value)}
                   placeholder="Category Name"
                   className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                   disabled={isDeploying}
                 />
                 <button 
                    type="submit" 
                    disabled={isDeploying}
                    className={`w-full px-4 py-2 text-white font-medium rounded-lg transition flex justify-center items-center ${isDeploying ? 'bg-slate-500 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 active:scale-95'}`}
                 >
                   {isDeploying ? (
                       <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>
                        Deploying...
                       </>
                   ) : 'Deploy to Production'}
                 </button>
              </form>
           </div>

           {/* List */}
           <div className="md:col-span-2">
              <h4 className="text-sm font-bold text-slate-700 uppercase mb-3">Active Controls ({categories.length})</h4>
              <div className="flex flex-wrap gap-2">
                 {categories.length === 0 && (
                     <p className="text-sm text-slate-400 italic">No custom categories found. Add one to start.</p>
                 )}
                 {categories.map(cat => (
                   <div key={cat.id} className="group flex items-center bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded text-sm font-medium shadow-sm hover:border-indigo-300 transition-all hover:scale-105">
                     {cat.name}
                     {!cat.isSystemDefault && (
                         <button 
                           onClick={(e) => { 
                             e.stopPropagation(); 
                             setDeleteTargetId(cat.id); // OPEN SAFETY GUARD
                           }}
                           className="ml-2 text-slate-300 hover:text-red-500 transition-colors w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-50"
                           title="Delete Category"
                         >
                            <span>&times;</span>
                         </button>
                     )}
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
      )}

      {/* TAB CONTENT: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-slide-up">
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
            <div>
                 <h3 className="text-sm font-bold text-slate-700">Immutable Security Log</h3>
                 <p className="text-xs text-slate-400">Read-Only View of Cloud Events</p>
            </div>
            <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportLogs}
                  className="px-3 py-1 bg-slate-800 text-white text-xs font-bold rounded border border-slate-700 hover:bg-slate-700 flex items-center gap-1 transition active:scale-95"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    EXPORT CSV
                </button>
                <button 
                  onClick={handleManualTestLog}
                  className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded border border-indigo-200 hover:bg-indigo-100 transition"
                >
                    + TEST WRITE
                </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-slate-500 border-b sticky top-0 shadow-sm z-10">
                <tr>
                  <th className="px-6 py-3 font-medium w-48">Timestamp</th>
                  <th className="px-6 py-3 font-medium">Actor</th>
                  <th className="px-6 py-3 font-medium">Action</th>
                  <th className="px-6 py-3 font-medium">Details</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-4 text-center text-slate-400 italic">No events recorded yet. Perform some actions!</td></tr>
                )}
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors animate-fade-in">
                    <td className="px-6 py-3 text-slate-500 text-xs font-mono">{formatTime(log.timestamp)}</td>
                    <td className="px-6 py-3 font-mono text-xs text-indigo-600">{log.actor}</td>
                    <td className="px-6 py-3 font-bold text-slate-700 text-xs">{log.action}</td>
                    <td className="px-6 py-3 text-slate-600">{log.details}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
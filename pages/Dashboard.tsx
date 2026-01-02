import React, { useState, useEffect } from 'react';
import { CutOff, Expense } from '../types';
import { formatCurrency } from '../utils/security';
import { playSystemSound } from '../utils/sound';

interface DashboardProps {
  cutoffs: CutOff[];
  expenses: Expense[];
}

export const Dashboard: React.FC<DashboardProps> = ({ cutoffs, expenses }) => {
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [animateBars, setAnimateBars] = useState(false);

  useEffect(() => {
    setTimeout(() => setAnimateBars(true), 100);
  }, []);

  const handleTogglePrivacy = () => {
    playSystemSound('toggle');
    setShowSensitiveData(!showSensitiveData);
  };

  const activeCutoff = cutoffs.find(c => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); 

    const [sY, sM, sD] = c.startDate.split('-').map(Number);
    const start = new Date(sY, sM - 1, sD);
    start.setHours(0, 0, 0, 0);

    const [eY, eM, eD] = c.endDate.split('-').map(Number);
    const end = new Date(eY, eM - 1, eD);
    end.setHours(23, 59, 59, 999); 

    return now >= start && now <= end;
  });

  const totalSavings = cutoffs.reduce((acc, curr) => acc + (curr.decryptedSavings || 0), 0);
  const activeExpensesList = activeCutoff 
    ? expenses.filter(e => e.cutOffId === activeCutoff.id) 
    : [];
  
  const activeTotalExpenses = activeExpensesList.reduce((acc, curr) => acc + (curr.decryptedAmount || 0), 0);
  const activeIncome = activeCutoff?.decryptedIncome || 0;
  const activeSavings = activeCutoff?.decryptedSavings || 0;
  const remainingBudget = activeCutoff 
    ? activeIncome - activeSavings - activeTotalExpenses
    : 0;

  const categoryTotals: Record<string, number> = {};
  activeExpensesList.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + (e.decryptedAmount || 0);
  });
  
  const categoryBreakdown = Object.entries(categoryTotals)
      .map(([name, amount]) => ({
          name, 
          amount, 
          percentage: activeTotalExpenses > 0 ? (amount / activeTotalExpenses) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

  const healthColor = remainingBudget < 0 ? 'text-red-600' : 'text-emerald-600';
  const healthBg = remainingBudget < 0 ? 'bg-red-50' : 'bg-emerald-50';

  const downloadReport = () => {
    playSystemSound('click');
    if (!activeCutoff || activeExpensesList.length === 0) {
        alert("No data available to export for the active period.");
        return;
    }
    const headers = "Date,Category,Description,Amount\n";
    const rows = activeExpensesList.map(e => 
        `${e.date},${e.category},"${e.description.replace(/"/g, '""')}",${e.decryptedAmount}`
    ).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + headers + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Secure_Report_${activeCutoff.startDate}_${activeCutoff.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Financial Analytics</h2>
           <p className="text-sm text-slate-500">Real-time Encrypted Data Visualization</p>
        </div>
        <div className="flex items-center space-x-2 w-full md:w-auto">
           <button 
             onClick={downloadReport}
             className="flex-1 md:flex-none flex items-center justify-center space-x-1 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-700 transition hover:shadow-lg active:scale-95"
           >
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
             <span>Export</span>
           </button>

           <div className="flex items-center space-x-2 bg-white p-1 rounded-xl border shadow-sm ml-2">
             <button 
               onClick={handleTogglePrivacy}
               className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 ${showSensitiveData ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}
             >
               {showSensitiveData ? 'UNMASKED' : 'HIDDEN'}
             </button>
           </div>
        </div>
      </div>

      {activeCutoff ? (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-200 transition-colors animate-slide-up" style={{animationDelay: '0ms'}}>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Income</p>
                <div className="text-2xl font-bold text-slate-800 mt-2 font-mono">
                {showSensitiveData ? formatCurrency(activeIncome) : '****'}
                </div>
                <p className="text-xs text-slate-400 mt-2">{activeCutoff.startDate} to {activeCutoff.endDate}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-200 transition-colors animate-slide-up" style={{animationDelay: '100ms'}}>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expenses</p>
                <div className="text-2xl font-bold text-orange-600 mt-2 font-mono">
                {showSensitiveData ? formatCurrency(activeTotalExpenses) : '****'}
                </div>
                <p className="text-xs text-slate-400 mt-2">{activeExpensesList.length} transactions</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-200 transition-colors animate-slide-up" style={{animationDelay: '200ms'}}>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Locked Savings</p>
                <div className="text-2xl font-bold text-blue-600 mt-2 font-mono">
                {showSensitiveData ? formatCurrency(activeSavings) : '****'}
                </div>
                <p className="text-xs text-slate-400 mt-2">Segregated Vault</p>
            </div>

            <div className={`p-6 rounded-2xl shadow-sm border ${healthBg} border-opacity-60 transition-colors animate-slide-up`} style={{animationDelay: '300ms'}}>
                <p className={`text-xs font-bold uppercase tracking-wider ${remainingBudget < 0 ? 'text-red-400' : 'text-emerald-600'}`}>
                Remaining Budget
                </p>
                <div className={`text-2xl font-bold mt-2 font-mono ${healthColor}`}>
                {showSensitiveData ? formatCurrency(remainingBudget) : '****'}
                </div>
                <p className={`text-xs mt-2 font-bold ${remainingBudget < 0 ? 'text-red-400' : 'text-emerald-600'}`}>
                {remainingBudget < 0 ? 'OVER BUDGET' : 'Within Limits'}
                </p>
            </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-slide-up" style={{animationDelay: '400ms'}}>
                <h3 className="font-bold text-slate-700 mb-6">Budget Utilization</h3>
                {categoryBreakdown.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <p className="text-sm text-slate-400 italic">No spending recorded for this period.</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {categoryBreakdown.map((cat, index) => (
                            <div key={cat.name}>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="font-medium text-slate-700">{cat.name}</span>
                                    <span className="font-mono text-slate-600 text-xs">
                                        {showSensitiveData ? formatCurrency(cat.amount) : '****'} 
                                        <span className="text-slate-400 ml-1">({cat.percentage.toFixed(1)}%)</span>
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-1000 ease-ios ${cat.percentage > 50 ? 'bg-orange-500' : 'bg-brand-500'}`} 
                                        style={{ width: animateBars ? `${cat.percentage}%` : '0%' }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      ) : (
        <div className="p-10 bg-white rounded-3xl text-center border border-slate-200 shadow-sm animate-pop">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
             <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <h3 className="text-lg font-bold text-slate-700">No Active Cut-Off</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            Today ({new Date().toLocaleDateString()}) doesn't fall into any created cut-off range. Please create a new one to start tracking.
          </p>
        </div>
      )}

      <div className="bg-indigo-900 text-white p-8 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-center animate-slide-up" style={{animationDelay: '500ms'}}>
        <div className="mb-4 md:mb-0">
          <h3 className="text-lg font-bold flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Total Vault Savings
          </h3>
          <p className="text-indigo-300 text-sm mt-1">Accumulated across all history</p>
        </div>
        <div className="text-4xl font-bold font-mono tracking-tight">
           {showSensitiveData ? formatCurrency(totalSavings) : '₱ ****'}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-slide-up" style={{animationDelay: '600ms'}}>
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-800">Cut-Off History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium whitespace-nowrap">Period</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">Income (Cipher)</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">Savings (Cipher)</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cutoffs.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-slate-400">No history found.</td></tr>
              )}
              {cutoffs.map((co) => (
                <tr key={co.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-slate-700 font-medium whitespace-nowrap">
                    {co.startDate} <span className="text-slate-400 mx-1">→</span> {co.endDate}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500 max-w-[120px] truncate" title={co.encryptedTotalIncome}>
                    {showSensitiveData ? formatCurrency(co.decryptedIncome || 0) : co.encryptedTotalIncome}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-emerald-600 max-w-[120px] truncate" title={co.encryptedTotalSavings}>
                    {showSensitiveData ? formatCurrency(co.decryptedSavings || 0) : co.encryptedTotalSavings}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      Closed
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
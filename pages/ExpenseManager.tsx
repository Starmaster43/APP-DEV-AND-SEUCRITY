import React, { useState, useEffect } from 'react';
import { CutOff, Expense, Category, RecurringTemplate } from '../types';
import { encryptData, formatCurrency, sanitizeInput } from '../utils/security';
import { subscribeToCategories, subscribeToTemplates, saveRecurringTemplate, deleteRecurringTemplate } from '../services/db'; 
import { playSystemSound } from '../utils/sound';

interface ExpenseManagerProps {
  cutoffs: CutOff[];
  expenses: Expense[];
  addExpense: (ex: Expense) => void;
  userId: string; 
}

export const ExpenseManager: React.FC<ExpenseManagerProps> = ({ cutoffs, expenses, addExpense, userId }) => {
  const [activeTab, setActiveTab] = useState<'ledger' | 'recurring'>('ledger');
  const [selectedCutOffId, setSelectedCutOffId] = useState<string>('');
  
  // Form State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(''); 
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Dynamic Data State
  const [cloudCategories, setCloudCategories] = useState<Category[]>([]);
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  
  // UX State
  const [isSuccess, setIsSuccess] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    setIsLoadingCategories(true);
    const unsubCats = subscribeToCategories((data) => {
      setCloudCategories(data);
      setIsLoadingCategories(false); 
    });
    const unsubTemps = subscribeToTemplates(userId, (data) => {
        setRecurringTemplates(data);
    });

    return () => {
        unsubCats();
        unsubTemps();
    };
  }, [refreshTrigger, userId]);

  const activeCutOff = cutoffs.find(c => c.id === selectedCutOffId);
  const currentExpenses = expenses.filter(e => e.cutOffId === selectedCutOffId);

  const SYSTEM_DEFAULTS = [
    'Food', 'Transport', 'Utilities', 'Housing', 'Personal', 'Medical', 'Savings'
  ];

  const allCategoryNames = Array.from(new Set([
    ...SYSTEM_DEFAULTS,
    ...cloudCategories.map(c => c.name)
  ]));
  
  allCategoryNames.sort();

  const totalExpenses = currentExpenses.reduce((acc, curr) => acc + (curr.decryptedAmount || 0), 0);
  const remainingBudget = activeCutOff 
    ? (activeCutOff.decryptedIncome || 0) - (activeCutOff.decryptedSavings || 0) - totalExpenses
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playSystemSound('click');
    setError(null);
    setIsSuccess(false);

    if (!activeCutOff) {
      playSystemSound('error');
      setError("Please select a cut-off period first.");
      return;
    }

    if (!description || !amount || !date) {
      playSystemSound('error');
      setError("All fields are required.");
      return;
    }
    
    const finalCategory = category || allCategoryNames[0];

    const expenseDate = new Date(date);
    const start = new Date(activeCutOff.startDate);
    const end = new Date(activeCutOff.endDate);

    if (expenseDate < start || expenseDate > end) {
      playSystemSound('error');
      setError(`Security Violation: Expense date must be between ${activeCutOff.startDate} and ${activeCutOff.endDate}.`);
      return;
    }

    const secureDescription = sanitizeInput(description);

    const newExpense: Expense = {
      id: Date.now().toString(),
      cutOffId: activeCutOff.id,
      userId: userId, 
      category: finalCategory,
      description: secureDescription, // Using sanitized value
      date,
      encryptedAmount: encryptData(amount),
      decryptedAmount: parseFloat(amount)
    };

    addExpense(newExpense);
    playSystemSound('success');
    
    setDescription('');
    setAmount('');
    
    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 3000);
  };
  
  // --- RECURRING LOGIC ---
  const handleSaveTemplate = async () => {
      playSystemSound('click');
      if (!description || !amount || !category) {
          playSystemSound('error');
          alert("Please fill in Description, Category and Amount to save as template.");
          return;
      }
      const newTemplate: Omit<RecurringTemplate, 'id'> = {
          userId,
          category,
          description: sanitizeInput(description),
          encryptedAmount: encryptData(amount),
          decryptedAmount: parseFloat(amount)
      };
      await saveRecurringTemplate(newTemplate);
      playSystemSound('success');
      alert("Template Saved!");
  };

  const handleImportTemplate = (tpl: RecurringTemplate) => {
      playSystemSound('click');
      if (!activeCutOff) {
          playSystemSound('error');
          alert("Select a cut-off first.");
          return;
      }
      
      const newExpense: Expense = {
          id: Date.now().toString(),
          cutOffId: activeCutOff.id,
          userId,
          category: tpl.category,
          description: tpl.description,
          date: activeCutOff.startDate, // Default to start date
          encryptedAmount: tpl.encryptedAmount,
          decryptedAmount: tpl.decryptedAmount
      };
      addExpense(newExpense);
      playSystemSound('success');
  };

  const handleDeleteTemplate = async (id: string) => {
      playSystemSound('delete');
      if(confirm("Remove this template?")) {
          await deleteRecurringTemplate(id);
      }
  };

  const handleSoftRefresh = () => {
    playSystemSound('toggle');
    setRefreshTrigger(prev => prev + 1);
  };

  const formatDateReadable = (dateString: string) => {
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleTabSwitch = (tab: 'ledger' | 'recurring') => {
      playSystemSound('toggle');
      setActiveTab(tab);
  };

  // THESIS: Live Encryption Preview
  const encryptedPreview = amount ? encryptData(amount) : 'Waiting for input...';
  const sanitizedPreview = description ? sanitizeInput(description) : '';

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-800">Secure Expense Ledger</h2>
          <div className="flex gap-2 bg-white p-1 rounded-xl border shadow-sm w-full md:w-auto">
              <button 
                onClick={() => handleTabSwitch('ledger')}
                className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ease-ios ${activeTab === 'ledger' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                  Active Ledger
              </button>
              <button 
                onClick={() => handleTabSwitch('recurring')}
                className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ease-ios ${activeTab === 'recurring' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                  Templates
              </button>
          </div>
      </div>

      {activeTab === 'ledger' && (
          <>
            {/* 1. Selector Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Active Cut-Off Period</label>
                <select 
                value={selectedCutOffId}
                onChange={(e) => setSelectedCutOffId(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer hover:border-brand-400 transition"
                >
                <option value="">-- Choose a Cut-Off to Manage --</option>
                {cutoffs.map(co => (
                    <option key={co.id} value={co.id}>
                    {co.startDate} to {co.endDate} (Income: {formatCurrency(co.decryptedIncome || 0)})
                    </option>
                ))}
                </select>
            </div>

            {activeCutOff && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
                
                {/* 2. Budget Overview Panel */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                        <span className="text-xs text-blue-600 font-bold uppercase">Net Income</span>
                        <div className="text-xl font-bold text-blue-900">{formatCurrency(activeCutOff.decryptedIncome || 0)}</div>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                        <span className="text-xs text-emerald-600 font-bold uppercase">Savings (Locked)</span>
                        <div className="text-xl font-bold text-emerald-900">{formatCurrency(activeCutOff.decryptedSavings || 0)}</div>
                    </div>
                    <div className={`p-4 rounded-2xl border transition-colors duration-500 ease-ios ${remainingBudget < 0 ? 'bg-red-50 border-red-100' : 'bg-slate-800 border-slate-700'}`}>
                        <span className={`text-xs font-bold uppercase ${remainingBudget < 0 ? 'text-red-600' : 'text-slate-400'}`}>Remaining Budget</span>
                        <div className={`text-xl font-bold ${remainingBudget < 0 ? 'text-red-700' : 'text-white'}`}>
                            {formatCurrency(remainingBudget)}
                        </div>
                    </div>
                </div>

                {/* 3. Add Expense Form */}
                <div className="lg:col-span-1">
                    <div className={`bg-white p-6 rounded-2xl shadow-lg border-t-4 h-full transition-colors duration-500 ease-ios ${isSuccess ? 'border-emerald-500 bg-emerald-50/30' : 'border-brand-500'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800">Add Encrypted Expense</h3>
                            {isSuccess && <span className="text-xs font-bold text-emerald-600 animate-pulse">Saved Successfully!</span>}
                        </div>
                        
                        {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded mb-4 border-l-4 border-red-500 animate-slide-up">{error}</div>}
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
                                <button 
                                type="button"
                                onClick={handleSoftRefresh}
                                className="text-[10px] text-brand-600 hover:text-brand-800 underline cursor-pointer"
                                >
                                Sync List
                                </button>
                            </div>
                            
                            <div className="space-y-1">
                                <select 
                                value={category} onChange={e => setCategory(e.target.value)}
                                className="w-full mt-1 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                                >
                                {!category && <option value="">-- Select Category --</option>}
                                {allCategoryNames.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Date</label>
                            <input 
                            type="date" required 
                            value={date} onChange={e => setDate(e.target.value)}
                            className="w-full mt-1 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Must be between {activeCutOff.startDate} and {activeCutOff.endDate}</p>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Description (Anti-XSS Active)</label>
                            <input 
                            type="text" required placeholder="e.g. Grocery"
                            value={description} onChange={e => setDescription(e.target.value)}
                            className="w-full mt-1 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                            {description && (
                                <div className="mt-1 p-1.5 bg-slate-50 rounded-lg border border-slate-200 text-[10px] text-slate-500 flex items-center gap-1 animate-fade-in">
                                    <span className="font-bold text-emerald-600">SANITIZED INPUT:</span> 
                                    <span className="font-mono">{sanitizedPreview}</span>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Amount (AES-256 Encrypted)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-slate-400">₱</span>
                                <input 
                                    type="number" required placeholder="0.00"
                                    value={amount} onChange={e => setAmount(e.target.value)}
                                    className="w-full pl-8 mt-1 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                                />
                            </div>
                            {/* THESIS: VISUALIZE ENCRYPTION */}
                            <div className="mt-1 p-3 bg-slate-900 rounded-lg border border-slate-700 text-[10px] text-slate-400 animate-fade-in">
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold text-indigo-400 uppercase">Encryption Visualizer</span>
                                    <span className="text-emerald-500">Active</span>
                                </div>
                                <code className="block break-all font-mono text-xs text-white opacity-80">
                                    {encryptedPreview}
                                </code>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className={`w-full text-white py-3 rounded-xl font-bold transition-all transform active:scale-95 shadow-md ${isSuccess ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-brand-600 hover:bg-brand-700'}`}
                        >
                            {isSuccess ? '✓ Securely Added' : 'Securely Add'}
                        </button>
                        
                        <div className="pt-2 border-t border-slate-100 mt-4">
                             <button type="button" onClick={handleSaveTemplate} className="text-xs text-indigo-500 hover:text-indigo-700 w-full text-center py-2 active:scale-95 transition-transform">
                                 + Save Current Input as Template
                             </button>
                        </div>
                        </form>
                    </div>
                </div>

                {/* 4. Expense List */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Quick Import Toolbar */}
                    {recurringTemplates.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-2xl flex flex-wrap gap-2 items-center">
                            <span className="text-xs font-bold text-indigo-700 uppercase mr-2">Quick Add:</span>
                            {recurringTemplates.map(t => (
                                <button 
                                  key={t.id}
                                  onClick={() => handleImportTemplate(t)}
                                  className="px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs text-indigo-600 hover:bg-indigo-100 transition shadow-sm active:scale-95"
                                  title={`Add ${t.description} (${formatCurrency(t.decryptedAmount || 0)})`}
                                >
                                    + {t.description}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center flex-shrink-0">
                            <h3 className="font-bold text-slate-700">Expense History</h3>
                            <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded border">AES-256 Encrypted</span>
                        </div>
                        <div className="overflow-auto max-h-[500px]">
                            {currentExpenses.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">No expenses recorded for this cut-off.</div>
                            ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 sticky top-0 shadow-sm z-10">
                                <tr>
                                    <th className="px-4 py-3 whitespace-nowrap">Date</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Category</th>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3 text-right whitespace-nowrap">Amount</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                {currentExpenses.map((ex, index) => (
                                    <tr 
                                        key={ex.id} 
                                        className="hover:bg-slate-50 transition-colors animate-slide-up"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                    <td className="px-4 py-3 whitespace-nowrap text-slate-900 font-medium">
                                        {formatDateReadable(ex.date)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                                        {ex.category}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={ex.description} dangerouslySetInnerHTML={{__html: ex.description}}></td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-900 font-bold">{formatCurrency(ex.decryptedAmount || 0)}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                            )}
                        </div>
                    </div>
                </div>

                </div>
            )}
          </>
      )}

      {/* RECURRING TAB */}
      {activeTab === 'recurring' && (
          <div className="animate-slide-in-right">
              <div className="bg-white p-8 rounded-2xl shadow-lg border-t-4 border-indigo-500">
                  <div className="mb-6">
                      <h3 className="text-xl font-bold text-slate-800">Recurring Expense Templates</h3>
                      <p className="text-sm text-slate-500">Define expenses like Rent, Internet, or Subscriptions once. Import them instantly into any cut-off.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {recurringTemplates.length === 0 && (
                          <div className="col-span-3 text-center py-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                              <p className="text-slate-400">No templates found. Save one from the "Active Ledger" tab.</p>
                          </div>
                      )}
                      {recurringTemplates.map(tpl => (
                          <div key={tpl.id} className="p-5 border border-slate-200 rounded-xl hover:shadow-md transition bg-white relative group animate-pop">
                              <div className="flex justify-between items-start mb-2">
                                  <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase rounded">{tpl.category}</span>
                                  <button 
                                    onClick={() => handleDeleteTemplate(tpl.id)}
                                    className="text-slate-300 hover:text-red-500 transition active:scale-90"
                                  >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                              </div>
                              <h4 className="font-bold text-slate-800 text-lg">{tpl.description}</h4>
                              <p className="text-2xl font-mono text-slate-600 mt-2">{formatCurrency(tpl.decryptedAmount || 0)}</p>
                              <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
                                  <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  Encrypted Template
                              </p>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
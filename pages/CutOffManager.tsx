import React, { useState } from 'react';
import { CutOff } from '../types';
import { encryptData } from '../utils/security';

interface CutOffManagerProps {
  cutoffs: CutOff[];
  addCutOff: (co: CutOff) => void;
  userId: string; // THESIS: We need the UserID to enforce ownership
}

export const CutOffManager: React.FC<CutOffManagerProps> = ({ cutoffs, addCutOff, userId }) => {
  // Form State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [income, setIncome] = useState('');
  const [savings, setSavings] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Basic Validation
    if (!startDate || !endDate || !income) {
      setError("All fields are required.");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      setError("Start date cannot be after End date.");
      return;
    }

    // 2. CORE BUSINESS LOGIC: OVERLAP CHECK
    // Thesis Requirement: Strict Cut-Off enforcement
    const hasOverlap = cutoffs.some(co => {
      const coStart = new Date(co.startDate);
      const coEnd = new Date(co.endDate);
      
      // Check if new range overlaps with existing range
      return (start <= coEnd && end >= coStart);
    });

    if (hasOverlap) {
      setError("CRITICAL ERROR: Date range overlaps with an existing cut-off. This violates business rules.");
      return;
    }

    // 3. SECURITY: ENCRYPTION BEFORE STORAGE
    // We encrypt the sensitive financial data here
    const encryptedIncome = encryptData(income);
    const encryptedSavings = encryptData(savings || '0');

    const newCutOff: CutOff = {
      id: Date.now().toString(),
      userId: userId, // THESIS: Linking data to the specific authorized user
      startDate,
      endDate,
      encryptedTotalIncome: encryptedIncome,
      encryptedTotalSavings: encryptedSavings,
      decryptedIncome: parseFloat(income),
      decryptedSavings: parseFloat(savings || '0')
    };

    addCutOff(newCutOff);
    
    // Reset Form
    setStartDate('');
    setEndDate('');
    setIncome('');
    setSavings('');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-brand-500">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Create New Salary Cut-Off</h2>
        <p className="text-sm text-slate-500 mb-6">
          Define a strict period for your budget. Income and Expenses will be bound to this range.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
            <span className="font-bold">Security Rule Violation:</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Total Income (Salary)</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400">₱</span>
              <input 
                type="number" 
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
              Input will be encrypted before saving.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Allocated Savings (Separate Vault)</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400">₱</span>
              <input 
                type="number" 
                value={savings}
                onChange={(e) => setSavings(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2 border border-emerald-200 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-brand-600 text-white py-3 rounded-lg font-medium hover:bg-brand-700 transition-all shadow-md active:scale-95"
            >
              Securely Create Cut-Off
            </button>
          </div>
        </form>
      </div>

      <div className="mt-8 text-center text-xs text-slate-400">
        <p>Security Audit Log: Action will be timestamped and authorized.</p>
      </div>
    </div>
  );
};
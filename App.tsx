import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { CutOffManager } from './pages/CutOffManager';
import { ExpenseManager } from './pages/ExpenseManager';
import { AdminDashboard } from './pages/AdminDashboard'; // Import new page
import { Login } from './pages/Login';
import { CutOff, Expense } from './types';
import { subscribeToCutoffs, subscribeToExpenses, saveCutOff, saveExpense } from './services/db';

// Main App Container to handle Routing Logic
const AppContainer: React.FC = () => {
  const { user, loading, isDemoMode } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  
  // REAL-TIME STATE
  const [cutoffs, setCutoffs] = useState<CutOff[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // RBAC CHECK
  const isAdmin = user?.email === 'admin@secure.com';

  // THESIS: Real-time Data Synchronization
  useEffect(() => {
    if (!user || isDemoMode || isAdmin) return; // Admins don't need personal expense listeners

    // 1. Subscribe to CutOffs
    const unsubscribeCutoffs = subscribeToCutoffs(user.uid, (data) => {
      setCutoffs(data);
    });

    // 2. Subscribe to Expenses
    const unsubscribeExpenses = subscribeToExpenses(user.uid, (data) => {
      setExpenses(data);
    });

    // Cleanup listeners
    return () => {
      unsubscribeCutoffs();
      unsubscribeExpenses();
    };
  }, [user, isDemoMode, isAdmin]);

  const handleAddCutOff = async (newCutOff: CutOff) => {
    if (isDemoMode) {
      setCutoffs([...cutoffs, newCutOff]); 
    } else {
      const { id, ...dataToSave } = newCutOff;
      // THESIS: Pass Email for Audit Logging
      await saveCutOff(dataToSave, user?.email || 'unknown');
    }
    setCurrentPage('dashboard');
  };

  const handleAddExpense = async (newExpense: Expense) => {
    if (isDemoMode) {
      setExpenses([...expenses, newExpense]);
    } else {
       const { id, ...dataToSave } = newExpense;
       // THESIS: Pass Email for Audit Logging
       await saveExpense(dataToSave, user?.email || 'unknown');
    }
  };

  if (loading) {
    // THESIS: Polished Splash Screen
    return (
      <div className="h-screen w-screen bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden">
         {/* Background Decoration */}
         <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 animate-gradient-x opacity-80"></div>
         
         <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <h1 className="text-2xl font-bold text-white tracking-widest animate-pulse-slow">SECURE SYSTEM</h1>
            <p className="text-indigo-400 text-xs mt-2 font-mono">Initializing Encryption Engine...</p>
         </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // THESIS: ROLE-BASED ROUTING
  // If Admin, bypass normal router and show Admin Console
  if (isAdmin) {
    return (
      <Layout currentPage="admin" setPage={() => {}}>
        <AdminDashboard />
      </Layout>
    );
  }

  return (
    <Layout currentPage={currentPage} setPage={setCurrentPage}>
      {/* THESIS: Passing expenses allows the Dashboard to perform live analytics */}
      {currentPage === 'dashboard' && <Dashboard cutoffs={cutoffs} expenses={expenses} />}
      {currentPage === 'cutoffs' && <CutOffManager cutoffs={cutoffs} addCutOff={handleAddCutOff} userId={user.uid} />}
      {currentPage === 'expenses' && <ExpenseManager cutoffs={cutoffs} expenses={expenses} addExpense={handleAddExpense} userId={user.uid} />}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContainer />
    </AuthProvider>
  );
};

export default App;
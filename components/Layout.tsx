import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { playSystemSound, initAudio } from '../utils/sound';

export const Layout: React.FC<{ children: React.ReactNode; currentPage: string; setPage: (p: string) => void }> = ({ children, currentPage, setPage }) => {
  const { logout, user, isDemoMode } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  
  // MOBILE STATE
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // THESIS: ROLE-BASED ACCESS CONTROL (RBAC)
  const isAdmin = user?.email === 'admin@secure.com';

  // Initialize Audio Engine on first interaction to prevent browser blocking
  useEffect(() => {
    const unlocker = () => {
        initAudio();
        window.removeEventListener('click', unlocker);
        window.removeEventListener('keydown', unlocker);
    };
    window.addEventListener('click', unlocker);
    window.addEventListener('keydown', unlocker);
    return () => {
        window.removeEventListener('click', unlocker);
        window.removeEventListener('keydown', unlocker);
    };
  }, []);

  const handleNavClick = (page: string) => {
    playSystemSound('click');
    setPage(page);
    setIsMobileMenuOpen(false); // Close menu on mobile after click
  };

  const toggleMobileMenu = () => {
    playSystemSound('toggle');
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleLogoutConfirm = () => {
    playSystemSound('click');
    setShowLogoutConfirm(true);
  };

  const handleLogout = async () => {
    playSystemSound('delete');
    await logout();
    setShowLogoutConfirm(false);
  };

  const handleDocsOpen = () => {
    playSystemSound('click');
    setShowSpecsModal(true);
  };

  // --- NAVIGATION ITEMS ---
  const NavItems = () => (
    <>
      {isAdmin ? (
            <button 
              className="w-full text-left px-4 py-3 rounded-xl bg-indigo-800 text-white font-medium shadow-inner flex items-center gap-3 transition-transform active:scale-95 mb-2"
            >
              <svg className="w-5 h-5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              System Overview
            </button>
      ) : (
        <>
          <button 
            onClick={() => handleNavClick('dashboard')}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-300 ease-ios flex items-center gap-3 active:scale-95 mb-1 ${currentPage === 'dashboard' ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            Dashboard
          </button>
          <button 
            onClick={() => handleNavClick('cutoffs')}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-300 ease-ios flex items-center gap-3 active:scale-95 mb-1 ${currentPage === 'cutoffs' ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Manage Cut-Offs
          </button>
          <button 
            onClick={() => handleNavClick('expenses')}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-300 ease-ios flex items-center gap-3 active:scale-95 mb-1 ${currentPage === 'expenses' ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            Expense Ledger
          </button>
        </>
      )}
    </>
  );

  return (
    // ROOT CONTAINER: Forces screen height and hides overflow to prevent double scrollbars
    <div className="h-screen w-screen bg-slate-50 flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* 1. MOBILE HEADER (Glassmorphism) */}
      <div className="md:hidden flex-none h-16 bg-slate-900/90 backdrop-blur-md text-white px-4 flex justify-between items-center shadow-lg z-50 sticky top-0 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
             <div className={`w-3 h-3 rounded-full ${isAdmin ? 'bg-indigo-400' : 'bg-brand-500'} animate-pulse`}></div>
             <span className="font-bold tracking-wider text-sm">{isAdmin ? 'ADMIN' : 'SECURE'} APP</span>
          </div>
          <button onClick={toggleMobileMenu} className="p-2 text-slate-300 hover:text-white transition active:scale-90">
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
             </svg>
          </button>
      </div>

      {/* 2. MODALS (Z-INDEX 60+) */}
      {showLogoutConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md animate-fade-in px-4">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-slate-600 animate-pop">
                  <h3 className="text-lg font-bold text-slate-800">Secure Logout</h3>
                  <p className="text-sm text-slate-500 mt-2">
                      Terminate session and clear encryption keys?
                  </p>
                  <div className="mt-6 flex gap-3">
                      <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">Cancel</button>
                      <button onClick={handleLogout} className="flex-1 px-4 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition shadow-lg">Terminate</button>
                  </div>
              </div>
          </div>
      )}

      {showSpecsModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-md animate-fade-in px-4">
            <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-pop relative">
                <button onClick={() => setShowSpecsModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-2">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="p-8">
                  <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">System Architecture</h2>
                  <p className="text-indigo-300 text-sm mb-6 border-b border-indigo-500/20 pb-4">Thesis Defense Reference</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                      <h3 className="text-emerald-400 font-bold text-sm uppercase mb-2">Security</h3>
                      <ul className="text-slate-300 text-xs space-y-2 list-disc pl-4">
                        <li>Simulated AES-256 Encryption</li>
                        <li>RBAC (Admin vs User)</li>
                        <li>Anti-XSS Sanitization</li>
                      </ul>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                      <h3 className="text-blue-400 font-bold text-sm uppercase mb-2">Stack</h3>
                      <ul className="text-slate-300 text-xs space-y-2 list-disc pl-4">
                        <li>React 18 + TypeScript</li>
                        <li>Firebase Auth & Firestore</li>
                        <li>Web Audio API</li>
                      </ul>
                    </div>
                  </div>
                </div>
            </div>
        </div>
      )}

      {/* 3. MOBILE DRAWER (Slide-Over) */}
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={toggleMobileMenu}
      />
      {/* Drawer Content */}
      <div className={`fixed inset-y-0 left-0 w-72 bg-slate-900 text-white z-50 transform transition-transform duration-300 ease-ios shadow-2xl md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
         <div className="p-6 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-8">
              <div className={`w-3 h-3 rounded-full ${isAdmin ? 'bg-indigo-400' : 'bg-brand-500'} animate-pulse`}></div>
              <h1 className="text-xl font-bold tracking-wider">{isAdmin ? 'ADMIN' : 'SECURE'} APP</h1>
            </div>
            <nav className="flex-1 space-y-2">
               <NavItems />
            </nav>
            <div className="mt-auto space-y-3 pt-6 border-t border-slate-800">
                <button onClick={handleDocsOpen} className="w-full py-3 text-indigo-300 text-xs font-bold border border-indigo-500/30 rounded-xl">System Docs</button>
                <button onClick={handleLogoutConfirm} className="w-full py-3 bg-red-900/20 text-red-400 text-sm font-bold rounded-xl border border-red-900/30">Logout</button>
            </div>
         </div>
      </div>

      {/* 4. DESKTOP SIDEBAR (Static) */}
      <aside className={`hidden md:flex flex-col w-64 ${isAdmin ? 'bg-indigo-950' : 'bg-slate-900'} text-white shadow-xl flex-shrink-0 z-20`}>
         <div className="p-6">
            <div className="flex items-center gap-2 mb-1">
               <div className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-indigo-400' : 'bg-brand-500'} animate-pulse`}></div>
               <h1 className="text-xl font-bold tracking-wider">{isAdmin ? 'ADMIN' : 'SECURE'}</h1>
            </div>
            <p className="text-xs text-slate-400">Thesis Prototype v1.0</p>
         </div>
         <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
            <NavItems />
         </nav>
         <div className="p-4 bg-gradient-to-t from-black/40 to-transparent space-y-3">
             <button onClick={handleDocsOpen} className="w-full py-2 text-indigo-300 text-xs font-bold border border-indigo-500/30 rounded-lg hover:bg-indigo-900/50 transition">System Specs</button>
             <div className="text-[10px] text-slate-500 truncate text-center">{user?.email}</div>
             <button onClick={handleLogoutConfirm} className="w-full py-2 bg-red-900/20 text-red-400 text-sm font-bold rounded-lg border border-red-900/30 hover:bg-red-900/40 transition">Secure Logout</button>
         </div>
      </aside>

      {/* 5. MAIN CONTENT AREA */}
      <main className="flex-1 relative overflow-y-auto h-full bg-slate-50 scroll-smooth">
         <div className="max-w-7xl mx-auto p-4 md:p-8 min-h-full pb-20">
            {children}
         </div>
      </main>

    </div>
  );
};
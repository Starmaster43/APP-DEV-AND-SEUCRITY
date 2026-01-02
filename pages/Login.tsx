import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { logSystemAction, submitAppeal } from '../services/db';
import { validateStrongPassword } from '../utils/security';
import { auth } from '../services/firebase'; 
import { playSystemSound } from '../utils/sound';

export const Login: React.FC = () => {
  const { login, register, isDemoMode, isLockedOut, loginAttempts } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // APPEAL STATE
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [appealSent, setAppealSent] = useState(false);
  const [lockedUid, setLockedUid] = useState(''); 

  // Real-time password feedback
  const passStrength = validateStrongPassword(pass);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    playSystemSound('click');
    setError('');
    setIsSubmitting(true);
    
    try {
      if (isLogin) {
        await login(email, pass);
        playSystemSound('success');
        await logSystemAction(email, 'LOGIN', 'User authenticated successfully', 'SUCCESS');
      } else {
        await register(email, pass);
        playSystemSound('success');
        await logSystemAction(email, 'REGISTER', 'New user account created', 'SUCCESS');
      }
    } catch (err: any) {
      playSystemSound('error');
      const msg = err.message || "Authentication failed";
      setError(msg);
      
      if (msg.includes("ACCOUNT LOCKED")) {
         playSystemSound('lock');
         setShowAppealForm(true);
         if (auth && auth.currentUser) {
             setLockedUid(auth.currentUser.uid);
         }
      }
      
      if (isLogin && !msg.includes("LOCKED")) {
          await logSystemAction(email || 'unknown', 'LOGIN_FAIL', `Auth failed: ${msg}`, 'WARN');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAppealSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      playSystemSound('click');
      setIsSubmitting(true);
      try {
          await submitAppeal(lockedUid || 'unknown_uid', email, appealReason);
          playSystemSound('success');
          setAppealSent(true);
      } catch (err: any) {
          playSystemSound('error');
          setError("Failed to submit appeal: " + err.message);
      } finally {
          setIsSubmitting(false);
      }
  };

  const toggleMode = () => {
     playSystemSound('toggle');
     setIsLogin(!isLogin);
     setError('');
     setPass('');
  };
  
  // --- RENDER APPEAL FORM IF LOCKED ---
  if (showAppealForm) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-900">
          <div className="absolute top-0 left-0 w-full h-full bg-red-900/20 animate-pulse-slow"></div>
          
          <div className="w-full max-w-md p-8 rounded-2xl shadow-2xl relative z-10 glass border border-red-500/50 animate-pop backdrop-blur-xl">
             <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-500 text-red-500">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Account Locked</h2>
                <p className="text-red-200 text-sm mt-2">Security protocols have suspended your access.</p>
             </div>

             {appealSent ? (
                 <div className="bg-emerald-900/50 border border-emerald-500/50 p-6 rounded-xl text-center">
                     <div className="text-emerald-400 text-4xl mb-2">✓</div>
                     <h3 className="text-white font-bold">Appeal Submitted</h3>
                     <p className="text-emerald-200 text-sm mt-2">
                         The System Administrator has received your request. You will be notified if access is restored.
                     </p>
                     <button onClick={() => setShowAppealForm(false)} className="mt-4 text-emerald-400 underline hover:text-white">Return to Login</button>
                 </div>
             ) : (
                 <form onSubmit={handleAppealSubmit} className="space-y-4">
                     <div className="bg-white/5 p-4 rounded-lg border border-white/10 text-sm text-slate-300">
                        <p><strong>Identity:</strong> {email}</p>
                        <p className="mt-1">You may submit a formal appeal to the administrator to review this security action.</p>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-red-200 uppercase mb-2">Reason for Appeal</label>
                        <textarea 
                           required
                           value={appealReason}
                           onChange={e => setAppealReason(e.target.value)}
                           className="w-full h-32 bg-black/40 border border-red-500/30 rounded-lg p-3 text-white focus:border-red-500 outline-none resize-none"
                           placeholder="Explain why your account should be unlocked..."
                        ></textarea>
                     </div>
                     <button 
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-red-900/50 active:scale-95"
                     >
                        {isSubmitting ? 'Transmitting...' : 'Submit Appeal to Admin'}
                     </button>
                     <button 
                        type="button"
                        onClick={() => setShowAppealForm(false)}
                        className="w-full text-slate-400 text-sm hover:text-white"
                     >
                        Cancel
                     </button>
                 </form>
             )}
          </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900 via-slate-950 to-black animate-gradient-x">
      
      {/* Decorative Elements for Aesthetics */}
      <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-blue-600/10 rounded-full mix-blend-screen filter blur-[100px] animate-pulse-slow" style={{animationDelay: '1.5s'}}></div>

      <div className="w-full max-w-md p-8 rounded-3xl shadow-2xl relative z-10 glass border border-slate-700/50 animate-pop backdrop-blur-xl">
        
        {isDemoMode && (
           <div className="bg-amber-500/10 border border-amber-500/50 text-amber-300 p-2.5 rounded-lg mb-6 text-xs backdrop-blur-sm flex justify-center">
             <p className="font-bold flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                SIMULATION ENVIRONMENT
             </p>
           </div>
        )}

        <div className="text-center mb-8">
           <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30 transform rotate-3 hover:rotate-0 transition-all duration-500 ease-ios group cursor-default">
             <svg className="w-8 h-8 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
           </div>
           <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-sm">Secure Access</h1>
           <p className="text-slate-400 text-sm mt-2 font-medium">Salary & Expense Management System</p>
        </div>

        {error && (
            <div className="bg-red-500/10 text-red-200 p-3 rounded-lg mb-6 text-sm border border-red-500/20 flex items-start gap-3 animate-slide-up">
                <svg className="w-5 h-5 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>{error}</span>
            </div>
        )}
        
        {isLockedOut && (
           <div className="bg-red-900/40 border border-red-500/50 text-red-100 p-4 mb-6 text-sm rounded-lg animate-pulse">
             <strong>SECURITY LOCKOUT:</strong><br/>
             Too many failed attempts. Login disabled for 30 seconds.
           </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider ml-1">Email Identity</label>
            <div className="relative group">
                <input 
                  type="email" 
                  required
                  disabled={isLockedOut || isSubmitting}
                  className="w-full px-4 py-3.5 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-white placeholder-slate-500 transition-all group-hover:border-slate-600"
                  placeholder="name@secure.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onClick={() => playSystemSound('click')}
                />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider ml-1">Access Key</label>
            <div className="relative group">
                <input 
                  type="password" 
                  required
                  disabled={isLockedOut || isSubmitting}
                  className="w-full px-4 py-3.5 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-white placeholder-slate-500 transition-all group-hover:border-slate-600 font-sans"
                  placeholder="••••••••"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  onClick={() => playSystemSound('click')}
                />
            </div>
            
            {!isLogin && pass.length > 0 && (
                <div className="mt-3 bg-slate-900/80 p-3 rounded-lg border border-slate-700/50 animate-slide-up">
                    <div className="flex justify-between items-center mb-2 text-xs">
                        <span className="text-slate-400">Security Strength</span>
                        <span className={passStrength.isValid ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                            {passStrength.isValid ? "Strong" : "Weak"}
                        </span>
                    </div>
                    {!passStrength.isValid && (
                        <p className="text-red-300 text-[10px] mb-2">{passStrength.message}</p>
                    )}
                    <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[10px] text-slate-500">
                        <span className={pass.length >= 8 ? "text-emerald-400" : ""}>✓ 8+ Chars</span>
                        <span className={/[A-Z]/.test(pass) ? "text-emerald-400" : ""}>✓ Uppercase</span>
                        <span className={/[0-9]/.test(pass) ? "text-emerald-400" : ""}>✓ Number</span>
                        <span className={/[!@#$%^&*]/.test(pass) ? "text-emerald-400" : ""}>✓ Symbol</span>
                    </div>
                </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={isLockedOut || isSubmitting}
            className={`w-full text-white py-4 rounded-2xl font-bold tracking-wide transition-all duration-300 ease-ios transform active:scale-[0.96] shadow-xl
                ${isLockedOut 
                    ? 'bg-slate-700 cursor-not-allowed text-slate-400' 
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/25 hover:shadow-indigo-500/40'
                } flex justify-center items-center mt-4`}
          >
             {isSubmitting ? (
                 <>
                   <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>
                   Verifying...
                 </>
             ) : (
                isLockedOut ? 'ACCESS LOCKED' : (isLogin ? 'AUTHENTICATE' : 'INITIALIZE ACCOUNT')
             )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={toggleMode}
            disabled={isLockedOut || isSubmitting}
            className="text-sm text-slate-400 hover:text-white transition-colors duration-200"
          >
            {isLogin ? (
                <>New to the system? <span className="text-indigo-400 hover:text-indigo-300 font-bold underline decoration-indigo-500/30 hover:decoration-indigo-400">Initialize Account</span></>
            ) : (
                <>Already secured? <span className="text-indigo-400 hover:text-indigo-300 font-bold underline decoration-indigo-500/30 hover:decoration-indigo-400">Sign In</span></>
            )}
          </button>
        </div>
        
        <div className="mt-8 pt-6 border-t border-slate-700/50 text-center">
           <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-medium opacity-70">
             AES-256 Encryption Standard
           </p>
        </div>
      </div>
    </div>
  );
};
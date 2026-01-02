import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth, isFirebaseInitialized } from '../services/firebase';
import { validateStrongPassword } from '../utils/security'; // Import Security Logic
import { syncUserProfile, checkUserLockStatus } from '../services/db';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  reauthenticate: (pass: string) => Promise<void>; // NEW: Step-Up Auth
  isDemoMode: boolean;
  loginAttempts: number; // For monitoring brute force
  isLockedOut: boolean;  // Lock status
}

const AuthContext = createContext<AuthContextType>(null!);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // SECURITY: BRUTE FORCE PROTECTION
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const LOCKOUT_THRESHOLD = 3;
  const LOCKOUT_TIME = 30000; // 30 seconds

  // SECURITY: Session Timeout Timer
  const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 Minutes
  const logoutTimerRef = useRef<any>(null);

  // Function to reset the security timer
  const resetTimer = () => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (user) {
        logoutTimerRef.current = setTimeout(() => {
            console.warn("Security Timeout: Auto-logging out due to inactivity.");
            logout();
            alert("Security Alert: You have been logged out due to inactivity.");
        }, INACTIVITY_LIMIT);
    }
  };

  useEffect(() => {
    if (!isFirebaseInitialized) {
        setLoading(false);
        return;
    }
    
    if (auth) {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          if (currentUser) {
            // Check if admin locked this account remotely
            const isBanned = await checkUserLockStatus(currentUser.uid);
            if (isBanned) {
               await signOut(auth);
               setUser(null);
               alert("ACCOUNT LOCKED: Contact Administrator for security review.");
            } else {
               setUser(currentUser);
               // Ensure user is registered in Admin DB
               syncUserProfile(currentUser.uid, currentUser.email || 'unknown');
            }
          } else {
             setUser(null);
          }
          setLoading(false);
        });
        return unsubscribe;
    }
  }, []);

  // SECURITY: Activity Listener
  useEffect(() => {
      if (!user) return;
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
      const handleActivity = () => resetTimer();
      events.forEach(event => window.addEventListener(event, handleActivity));
      resetTimer();
      return () => {
          if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
          events.forEach(event => window.removeEventListener(event, handleActivity));
      };
  }, [user]);

  const login = async (email: string, pass: string) => {
    // 1. Check Rate Limiting
    if (isLockedOut) {
      throw new Error("Security Lockout: Too many failed attempts. Please wait 30 seconds.");
    }

    if (!isFirebaseInitialized) {
        // MOCK LOGIN FOR DEMO
        console.log("Simulating Login...");
        const mockUser = { uid: "demo", email: email } as User; 
        setUser(mockUser);
        return;
    }
    
    if (!auth) throw new Error("Firebase auth not initialized");

    try {
        const result = await signInWithEmailAndPassword(auth, email, pass);
        // Immediate Lock Check
        const isBanned = await checkUserLockStatus(result.user.uid);
        if (isBanned) {
            await signOut(auth);
            throw new Error("ACCOUNT LOCKED: Access Denied by Administrator.");
        }

        // Reset attempts on success
        setLoginAttempts(0);
    } catch (error: any) {
        // Increment Failed Attempts
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);

        if (newAttempts >= LOCKOUT_THRESHOLD) {
          setIsLockedOut(true);
          setTimeout(() => {
            setIsLockedOut(false);
            setLoginAttempts(0);
          }, LOCKOUT_TIME);
          throw new Error(`Security Alert: Maximum attempts reached. Account locked for 30s.`);
        }

        if (error.code === 'auth/invalid-credential') {
            throw new Error(`Security Alert: Invalid credentials. Attempt ${newAttempts}/${LOCKOUT_THRESHOLD}`);
        }
        throw error;
    }
  };

  const register = async (email: string, pass: string) => {
    // 1. THESIS REQUIREMENT: Enforce Password Complexity BEFORE sending to Firebase
    const passwordCheck = validateStrongPassword(pass);
    if (!passwordCheck.isValid) {
      throw new Error(`Security Policy: ${passwordCheck.message}`);
    }

    if (!isFirebaseInitialized) {
        await login(email, pass);
        return;
    }

    if (!auth) throw new Error("Firebase auth not initialized");
    
    try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        // Register in DB
        await syncUserProfile(res.user.uid, email);
    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            throw new Error("Account Error: This email is already registered.");
        }
        throw error;
    }
  };

  const logout = async () => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (!isFirebaseInitialized) {
        setUser(null);
        return;
    }
    if (!auth) throw new Error("Firebase auth not initialized");
    await signOut(auth);
  };

  // THESIS REQUIREMENT: Step-Up Authentication for sensitive actions
  const reauthenticate = async (pass: string) => {
      // 1. Handle Demo Mode / Offline Simulation
      if (!isFirebaseInitialized) {
          if (!pass) throw new Error("Password required for simulation.");
          // In simulation, we accept any non-empty password to proceed
          return;
      }

      if (!auth || !auth.currentUser || !user) throw new Error("No active session");
      if (!user.email) throw new Error("User has no email");
      
      const credential = EmailAuthProvider.credential(user.email, pass);
      try {
          await reauthenticateWithCredential(auth.currentUser, credential);
      } catch (e) {
          throw new Error("Security Clearance Failed: Password Incorrect.");
      }
  };

  return (
    <AuthContext.Provider value={{ 
        user, 
        loading, 
        login, 
        register, 
        logout,
        reauthenticate,
        isDemoMode: !isFirebaseInitialized,
        loginAttempts,
        isLockedOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};
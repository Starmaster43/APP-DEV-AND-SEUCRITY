import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp,
  limit 
} from 'firebase/firestore';
import { db } from './firebase';
import { CutOff, Expense, Category, AuditLog, UserMetadata, AccessAppeal, RecurringTemplate } from '../types';
import { decryptData } from '../utils/security';

/**
 * THESIS MODULE: CLOUD PERSISTENCE & HYBRID STORAGE
 * 
 * This service manages the Data Layer.
 * It prioritizes the Secure Cloud Database (Firebase).
 * If the connection drops or keys are missing, it enables a temporary "Offline Mode".
 */

// --- IN-MEMORY STORE (Offline Fallback & Cache) ---
let MOCK_CATEGORIES: Category[] = []; 
let MOCK_CUTOFFS: CutOff[] = [];
let MOCK_EXPENSES: Expense[] = [];
let MOCK_LOGS: AuditLog[] = [];
let MOCK_USERS: UserMetadata[] = [];
let MOCK_APPEALS: AccessAppeal[] = [];
let MOCK_TEMPLATES: RecurringTemplate[] = []; // NEW: Templates Store

// THESIS FIX: DUAL-KEY TOMBSTONES (Prevents Zombies)
const PENDING_DELETES = new Set<string>(); 
const PENDING_DELETE_NAMES = new Set<string>();

// Event System for Unified Updates
const listeners: Record<string, Function[]> = {
  categories: [],
  cutoffs: [],
  expenses: [],
  logs: [],
  admin_all_expenses: [], 
  admin_all_cutoffs: [],
  admin_users: [],
  admin_appeals: [],
  recurring: [] // NEW Channel
};

const notifyListeners = (key: string, data: any) => {
  if (listeners[key]) {
    const safeData = Array.isArray(data) ? [...data] : data;
    listeners[key].forEach(cb => cb(safeData));
  }
};

// --- HELPER: PROMISE TIMEOUT ---
const withTimeout = (promise: Promise<any>, ms: number = 3000) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms))
    ]);
};

// --- SECURITY AUDIT LOGGING ---
export const logSystemAction = async (actor: string, action: string, details: string, status: 'SUCCESS' | 'WARN' | 'ERROR' = 'SUCCESS') => {
  const newLog: AuditLog = {
    id: Date.now().toString(),
    timestamp: new Date(), 
    actor,
    action,
    details,
    status
  };
  
  MOCK_LOGS = [newLog, ...MOCK_LOGS];
  notifyListeners('logs', MOCK_LOGS);

  if (db) {
    addDoc(collection(db, 'audit_logs'), {
      timestamp: Timestamp.now(),
      actor,
      action,
      details,
      status
    }).catch(e => {
       console.warn("Log write failed silently:", e.message);
    });
  }
};

export const subscribeToAuditLogs = (
  callback: (data: AuditLog[]) => void, 
  onStatusChange?: (isOnline: boolean) => void
) => {
  listeners['logs'].push(callback);
  callback([...MOCK_LOGS]); 

  let unsubscribe = () => {};

  if (db) {
    try {
      const q = query(collection(db, 'audit_logs'), limit(50));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => {
           const d = doc.data();
           const date = d.timestamp?.toDate ? d.timestamp.toDate() : new Date();
           return { id: doc.id, ...d, timestamp: date };
        }) as AuditLog[];
        logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        MOCK_LOGS = logs;
        if (onStatusChange) onStatusChange(true);
        notifyListeners('logs', MOCK_LOGS);
      }, (err) => {
        if (onStatusChange) onStatusChange(false);
      });
    } catch (e) {
       if (onStatusChange) onStatusChange(false);
    }
  } else {
    if (onStatusChange) onStatusChange(false);
  }
  
  return () => {
      unsubscribe();
      listeners['logs'] = listeners['logs'].filter(cb => cb !== callback);
  };
};


// --- SYSTEM GOVERNANCE (ADMIN FEATURES) ---

export const subscribeToCategories = (callback: (data: Category[]) => void) => {
  listeners['categories'].push(callback);
  callback([...MOCK_CATEGORIES]);

  let unsubscribeFirestore = () => {};

  if (db) {
    try {
      const q = query(collection(db, 'categories'));
      
      unsubscribeFirestore = onSnapshot(q, (snapshot) => {
        let categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[];
        
        // THESIS FIX: Filter Zombies by ID OR Name
        categories = categories.filter(c => {
             const isIdDead = PENDING_DELETES.has(c.id);
             const isNameDead = PENDING_DELETE_NAMES.has(c.name.trim().toLowerCase());
             return !isIdDead && !isNameDead;
        });

        const cloudNames = new Set(categories.map(c => c.name.toLowerCase()));
        
        const pendingItems = MOCK_CATEGORIES.filter(c => {
            const normalized = c.name.trim().toLowerCase();
            return !cloudNames.has(normalized) && 
                   !PENDING_DELETES.has(c.id) && 
                   !PENDING_DELETE_NAMES.has(normalized);
        });
        
        const merged = [...categories, ...pendingItems];
        merged.sort((a, b) => a.name.localeCompare(b.name));

        MOCK_CATEGORIES = merged; 
        notifyListeners('categories', MOCK_CATEGORIES);
      }, (error: any) => {
        console.error("Category Sync Error:", error);
      });
    } catch (e) {
      console.error("Setup Error", e);
    }
  }

  return () => {
    unsubscribeFirestore();
    listeners['categories'] = listeners['categories'].filter(cb => cb !== callback);
  };
};

export const addSystemCategory = async (name: string, adminEmail: string) => {
  const normalizedName = name.trim().toLowerCase();
  
  if (PENDING_DELETE_NAMES.has(normalizedName)) {
      PENDING_DELETE_NAMES.delete(normalizedName);
  }
  
  if (MOCK_CATEGORIES.some(c => c.name.toLowerCase() === normalizedName)) {
     throw new Error(`Category '${name}' already exists.`);
  }

  if (!db) {
      const tempId = 'temp_' + Date.now();
      const newCat: Category = { 
        id: tempId, 
        name: name.trim(), 
        isSystemDefault: false, 
        createdAt: Date.now() 
      };
      MOCK_CATEGORIES = [...MOCK_CATEGORIES, newCat];
      notifyListeners('categories', MOCK_CATEGORIES);
      logSystemAction(adminEmail, 'CATEGORY_ADD', `Added ${name} (Simulation)`, 'WARN');
  } else {
    try {
      const writeOp = addDoc(collection(db, 'categories'), {
        name: name.trim(),
        isSystemDefault: false,
        createdAt: Timestamp.now()
      });
      await withTimeout(writeOp, 5000); 
      logSystemAction(adminEmail, 'CATEGORY_ADD', `Added global category: ${name}`, 'SUCCESS');
    } catch (e: any) {
      throw new Error(`Cloud Error: ${e.message}`);
    }
  }
};

export const deleteSystemCategory = async (id: string, adminEmail: string) => {
  const target = MOCK_CATEGORIES.find(c => c.id === id);
  if (target) {
      PENDING_DELETE_NAMES.add(target.name.trim().toLowerCase());
  }
  PENDING_DELETES.add(id);
  MOCK_CATEGORIES = MOCK_CATEGORIES.filter(c => c.id !== id);
  notifyListeners('categories', MOCK_CATEGORIES);

  if (db) {
    if (id.startsWith('temp_')) {
        PENDING_DELETES.delete(id); 
        return;
    }
    try {
       await deleteDoc(doc(db, 'categories', id));
       logSystemAction(adminEmail, 'CATEGORY_DELETE', `Removed global category ID: ${id}`, 'WARN');
    } catch (e: any) {
       console.error("Delete Failed:", e);
    }
  } 
};

// --- USER SECURITY & APPEALS (UPDATED) ---

export const syncUserProfile = async (uid: string, email: string) => {
    if (!db) {
        // Offline Mock: Ensure user exists in MOCK_USERS
        if (!MOCK_USERS.find(u => u.uid === uid)) {
            MOCK_USERS.push({
                uid,
                email,
                lastLogin: new Date().toISOString(),
                isLocked: false,
                riskScore: 0
            });
            notifyListeners('admin_users', MOCK_USERS);
        }
        return;
    }
    const userRef = doc(db, 'users', uid);
    try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
            await setDoc(userRef, {
                uid,
                email,
                lastLogin: new Date().toISOString(),
                isLocked: false,
                riskScore: 0
            });
        } else {
            await updateDoc(userRef, { lastLogin: new Date().toISOString() });
        }
    } catch (e) {
        console.error("User Sync Error", e);
    }
};

export const checkUserLockStatus = async (uid: string): Promise<boolean> => {
    if (!db) {
        const user = MOCK_USERS.find(u => u.uid === uid);
        return user ? user.isLocked : false;
    }
    try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists() && snap.data().isLocked) {
            return true;
        }
    } catch (e) { return false; }
    return false;
};

export const subscribeToUsers = (callback: (data: UserMetadata[]) => void) => {
    listeners['admin_users'].push(callback);
    callback([...MOCK_USERS]);
    
    let unsubscribe = () => {};
    if (db) {
        const q = query(collection(db, 'users'), limit(100));
        unsubscribe = onSnapshot(q, (snapshot) => {
            const users = snapshot.docs.map(doc => ({ ...doc.data() })) as UserMetadata[];
            MOCK_USERS = users;
            notifyListeners('admin_users', MOCK_USERS);
        });
    }
    return () => {
        unsubscribe();
        listeners['admin_users'] = listeners['admin_users'].filter(cb => cb !== callback);
    };
};

export const toggleUserLock = async (targetUid: string, currentStatus: boolean, adminEmail: string, adminUid: string) => {
    // THESIS REQUIREMENT: SELF-LOCK PREVENTION
    if (targetUid === adminUid) {
        throw new Error("SECURITY VIOLATION: Administrators cannot lock their own root access.");
    }

    if (!db) {
        // OFFLINE MOCK HANDLE
        MOCK_USERS = MOCK_USERS.map(u => u.uid === targetUid ? { ...u, isLocked: !currentStatus } : u);
        notifyListeners('admin_users', MOCK_USERS);
        
        await logSystemAction(adminEmail, 'ADMIN_LOCK_TOGGLE', `User ${targetUid} lock status set to ${!currentStatus} (Offline)`, 'WARN');
        return; // Return early for offline
    }
    
    const userRef = doc(db, 'users', targetUid);
    await updateDoc(userRef, { isLocked: !currentStatus });
    
    await logSystemAction(adminEmail, 'ADMIN_LOCK_TOGGLE', `User ${targetUid} lock status set to ${!currentStatus}`, 'WARN');
};

// --- APPEAL SYSTEM ---

export const submitAppeal = async (uid: string, email: string, reason: string) => {
    if (!db) {
        // OFFLINE MOCK HANDLE
        MOCK_APPEALS = [{
             id: Date.now().toString(),
             uid,
             email,
             reason,
             status: 'PENDING',
             timestamp: new Date().toISOString()
        }, ...MOCK_APPEALS];
        notifyListeners('admin_appeals', MOCK_APPEALS);
        await logSystemAction(email, 'APPEAL_SUBMIT', 'User submitted lockout appeal (Offline)', 'WARN');
        return;
    }
    
    await addDoc(collection(db, 'appeals'), {
        uid,
        email,
        reason,
        status: 'PENDING',
        timestamp: new Date().toISOString()
    });
    
    await logSystemAction(email, 'APPEAL_SUBMIT', 'User submitted lockout appeal', 'WARN');
};

export const subscribeToAppeals = (callback: (data: AccessAppeal[]) => void) => {
    listeners['admin_appeals'].push(callback);
    callback([...MOCK_APPEALS]);

    let unsubscribe = () => {};
    if (db) {
        const q = query(collection(db, 'appeals'), limit(50));
        unsubscribe = onSnapshot(q, (snapshot) => {
            const appeals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AccessAppeal[];
            appeals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            MOCK_APPEALS = appeals;
            notifyListeners('admin_appeals', MOCK_APPEALS);
        });
    }
    return () => {
        unsubscribe();
        listeners['admin_appeals'] = listeners['admin_appeals'].filter(cb => cb !== callback);
    };
};

export const resolveAppeal = async (appealId: string, newStatus: 'APPROVED' | 'REJECTED', adminEmail: string) => {
    if (!db) {
        // OFFLINE MOCK HANDLE
        MOCK_APPEALS = MOCK_APPEALS.map(a => a.id === appealId ? { ...a, status: newStatus } : a);
        notifyListeners('admin_appeals', MOCK_APPEALS);
        await logSystemAction(adminEmail, 'APPEAL_DECISION', `Appeal ${appealId} set to ${newStatus} (Offline)`, 'SUCCESS');
        return;
    }

    const appealRef = doc(db, 'appeals', appealId);
    await updateDoc(appealRef, { status: newStatus });
    logSystemAction(adminEmail, 'APPEAL_DECISION', `Appeal ${appealId} set to ${newStatus}`, 'SUCCESS');
};

// --- RECURRING TEMPLATES (NEW) ---

export const subscribeToTemplates = (userId: string, callback: (data: RecurringTemplate[]) => void) => {
    const userCallback = (allData: RecurringTemplate[]) => {
        callback(allData.filter(t => t.userId === userId));
    };
    listeners['recurring'].push(userCallback);
    userCallback([...MOCK_TEMPLATES]);

    let unsubscribe = () => {};
    if (db) {
        const q = query(collection(db, 'recurring_templates'), where('userId', '==', userId));
        unsubscribe = onSnapshot(q, (snapshot) => {
            const templates = snapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                    id: doc.id, 
                    ...data,
                    decryptedAmount: parseFloat(decryptData(data.encryptedAmount))
                };
            }) as RecurringTemplate[];
            
            // Merge strategy
            const cloudIds = new Set(templates.map(t => t.id));
            const optimistic = MOCK_TEMPLATES.filter(t => t.userId === userId && !cloudIds.has(t.id));
            const others = MOCK_TEMPLATES.filter(t => t.userId !== userId);
            
            MOCK_TEMPLATES = [...others, ...templates, ...optimistic];
            notifyListeners('recurring', MOCK_TEMPLATES);
        });
    }
    return () => {
        unsubscribe();
        listeners['recurring'] = listeners['recurring'].filter(cb => cb !== userCallback);
    };
};

export const saveRecurringTemplate = async (template: Omit<RecurringTemplate, 'id'>) => {
    if (!db) {
        const newTemp = { id: Date.now().toString(), ...template } as RecurringTemplate;
        MOCK_TEMPLATES = [...MOCK_TEMPLATES, newTemp];
        notifyListeners('recurring', MOCK_TEMPLATES);
        return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { decryptedAmount, ...securePayload } = template;
    await addDoc(collection(db, 'recurring_templates'), { ...securePayload, createdAt: Timestamp.now() });
};

export const deleteRecurringTemplate = async (id: string) => {
    if (!db) {
        MOCK_TEMPLATES = MOCK_TEMPLATES.filter(t => t.id !== id);
        notifyListeners('recurring', MOCK_TEMPLATES);
        return;
    }
    await deleteDoc(doc(db, 'recurring_templates', id));
};

// --- CUT-OFFS MANAGEMENT ---

export const subscribeToCutoffs = (userId: string, callback: (data: CutOff[]) => void) => {
  const userCallback = (allData: CutOff[]) => {
      callback(allData.filter(c => c.userId === userId));
  };

  listeners['cutoffs'].push(userCallback);
  userCallback([...MOCK_CUTOFFS]);

  let unsubscribe = () => {};

  if (db) {
    try {
      const q = query(collection(db, 'cutoffs'), where('userId', '==', userId));
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const cloudData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            decryptedIncome: parseFloat(decryptData(data.encryptedTotalIncome)),
            decryptedSavings: parseFloat(decryptData(data.encryptedTotalSavings))
          };
        }) as CutOff[];

        cloudData.sort((a, b) => b.startDate.localeCompare(a.startDate));

        const cloudIds = new Set(cloudData.map(c => c.id));
        const optimistic = MOCK_CUTOFFS.filter(c => c.userId === userId && !cloudIds.has(c.id));
        const others = MOCK_CUTOFFS.filter(c => c.userId !== userId);
        
        MOCK_CUTOFFS = [...others, ...cloudData, ...optimistic];
        notifyListeners('cutoffs', MOCK_CUTOFFS);
      }, (err) => {
        console.error("Cutoff Sync Error:", err.message);
      });
    } catch (e) { console.error(e); }
  }
  
  return () => {
      unsubscribe();
      listeners['cutoffs'] = listeners['cutoffs'].filter(cb => cb !== userCallback);
  };
};

export const saveCutOff = async (cutoff: Omit<CutOff, 'id'>, userEmail: string) => {
  // BUG FIX: Only update local state manually if Offline
  if (!db) {
      const newCo: CutOff = { id: Date.now().toString(), ...cutoff } as CutOff;
      MOCK_CUTOFFS = [newCo, ...MOCK_CUTOFFS];
      notifyListeners('cutoffs', MOCK_CUTOFFS);
      await logSystemAction(userEmail, 'CUTOFF_CREATE', `Created period ${cutoff.startDate} to ${cutoff.endDate}`, 'SUCCESS');
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { decryptedIncome, decryptedSavings, ...securePayload } = cutoff;
    addDoc(collection(db, 'cutoffs'), { ...securePayload, createdAt: Timestamp.now() })
      .then(() => logSystemAction(userEmail, 'CUTOFF_CREATE', `Created period ${cutoff.startDate} to ${cutoff.endDate}`, 'SUCCESS'))
      .catch(e => console.error("Cutoff save failed to Cloud:", e.message));
  }
};

// --- EXPENSE MANAGEMENT ---

export const subscribeToExpenses = (userId: string, callback: (data: Expense[]) => void) => {
  const userCallback = (allData: Expense[]) => {
      callback(allData.filter(e => e.userId === userId));
  };

  listeners['expenses'].push(userCallback);
  userCallback([...MOCK_EXPENSES]);

  let unsubscribe = () => {};

  if (db) {
    try {
      const q = query(collection(db, 'expenses'), where('userId', '==', userId));
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const cloudData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            decryptedAmount: parseFloat(decryptData(data.encryptedAmount))
          };
        }) as Expense[];

        cloudData.sort((a, b) => b.date.localeCompare(a.date));

        const cloudIds = new Set(cloudData.map(c => c.id));
        const optimistic = MOCK_EXPENSES.filter(c => c.userId === userId && !cloudIds.has(c.id));
        const others = MOCK_EXPENSES.filter(c => c.userId !== userId);
        
        MOCK_EXPENSES = [...others, ...cloudData, ...optimistic];
        notifyListeners('expenses', MOCK_EXPENSES);
      }, (err) => {
         console.error("Expense Sync Error:", err.message);
      });
    } catch (e) { console.error(e); }
  }
  
  return () => {
      unsubscribe();
      listeners['expenses'] = listeners['expenses'].filter(cb => cb !== userCallback);
  };
};

export const saveExpense = async (expense: Omit<Expense, 'id'>, userEmail: string) => {
  // BUG FIX: Only update local state manually if Offline
  // If Online, Firestore onSnapshot handles it via 'pending writes'
  if (!db) {
      const newEx: Expense = { id: Date.now().toString(), ...expense } as Expense;
      MOCK_EXPENSES = [newEx, ...MOCK_EXPENSES];
      notifyListeners('expenses', MOCK_EXPENSES);
      await logSystemAction(userEmail, 'EXPENSE_ADD', `Added expense to ${expense.category}`, 'SUCCESS');
  } else {
     // eslint-disable-next-line @typescript-eslint/no-unused-vars
     const { decryptedAmount, ...securePayload } = expense;
     addDoc(collection(db, 'expenses'), { ...securePayload, createdAt: Timestamp.now() })
        .then(() => logSystemAction(userEmail, 'EXPENSE_ADD', `Added expense to ${expense.category}`, 'SUCCESS'))
        .catch(e => console.error("Expense save failed to Cloud:", e.message));
  }
};

// --- ADMIN: GLOBAL OBSERVABILITY (NEW) ---
export const subscribeToAllExpenses = (callback: (data: Expense[]) => void) => {
    listeners['admin_all_expenses'].push(callback);
    callback([...MOCK_EXPENSES]); 

    let unsubscribe = () => {};
    if (db) {
        try {
            const q = query(collection(db, 'expenses'), limit(500)); 
            unsubscribe = onSnapshot(q, (snapshot) => {
                const cloudData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        decryptedAmount: parseFloat(decryptData(data.encryptedAmount))
                    };
                }) as Expense[];
                
                const others = MOCK_EXPENSES.filter(e => !cloudData.find(c => c.id === e.id));
                MOCK_EXPENSES = [...others, ...cloudData];
                notifyListeners('admin_all_expenses', MOCK_EXPENSES);
            });
        } catch(e) { console.error("Admin Expense Sync Error", e); }
    }
    return () => {
        unsubscribe();
        listeners['admin_all_expenses'] = listeners['admin_all_expenses'].filter(cb => cb !== callback);
    };
};

export const subscribeToAllCutoffs = (callback: (data: CutOff[]) => void) => {
    listeners['admin_all_cutoffs'].push(callback);
    callback([...MOCK_CUTOFFS]);

    let unsubscribe = () => {};
    if (db) {
        try {
            const q = query(collection(db, 'cutoffs'), limit(500));
            unsubscribe = onSnapshot(q, (snapshot) => {
                const cloudData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        decryptedIncome: parseFloat(decryptData(data.encryptedTotalIncome))
                    };
                }) as CutOff[];

                const others = MOCK_CUTOFFS.filter(c => !cloudData.find(d => d.id === c.id));
                MOCK_CUTOFFS = [...others, ...cloudData];
                notifyListeners('admin_all_cutoffs', MOCK_CUTOFFS);
            });
        } catch(e) { console.error("Admin Cutoff Sync Error", e); }
    }
    return () => {
        unsubscribe();
        listeners['admin_all_cutoffs'] = listeners['admin_all_cutoffs'].filter(cb => cb !== callback);
    };
};
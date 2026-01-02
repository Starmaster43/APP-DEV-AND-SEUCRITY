export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  createdAt: number;
}

// THESIS: User Metadata for Admin Governance
export interface UserMetadata {
  uid: string;
  email: string;
  lastLogin: string;
  isLocked: boolean; // Admin can toggle this
  riskScore: number; // Calculated based on anomalies
}

// THESIS: New Entity for Handling Lockout Disputes
export interface AccessAppeal {
  id: string;
  uid: string;
  email: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  timestamp: string;
}

// THESIS: System Configuration Entity
export interface Category {
  id: string;
  name: string;
  isSystemDefault: boolean; // If true, cannot be deleted
  createdAt: any;
}

// THESIS: Security Audit Log Entity
export interface AuditLog {
  id: string;
  timestamp: any; // Firestore Timestamp
  actor: string;  // Email or User ID of who performed the action
  action: string; // e.g., "LOGIN", "CREATE_EXPENSE"
  details: string; // Human readable description
  status: 'SUCCESS' | 'WARN' | 'ERROR';
}

// Core Thesis Entity: The Cut-Off
export interface CutOff {
  id: string;
  userId: string;
  startDate: string; // ISO Date String YYYY-MM-DD
  endDate: string;   // ISO Date String YYYY-MM-DD
  
  // Encrypted Fields (Thesis Requirement: Data Encryption)
  // These are stored as encrypted strings in DB, decrypted in UI
  encryptedTotalIncome: string; 
  encryptedTotalSavings: string; 
  
  // We keep a local decrypted version for UI rendering only
  decryptedIncome?: number;
  decryptedSavings?: number;
}

export interface Expense {
  id: string;
  cutOffId: string;
  userId: string;
  category: string;
  date: string;
  description: string;
  
  // Encrypted Field
  encryptedAmount: string;
  decryptedAmount?: number;
}

// NEW: Recurring Expense Templates (Subscriptions)
export interface RecurringTemplate {
  id: string;
  userId: string;
  category: string;
  description: string;
  encryptedAmount: string; // Stored encrypted
  decryptedAmount?: number; // UI only
}

export interface DateRange {
  start: Date;
  end: Date;
}
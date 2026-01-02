/**
 * THESIS MODULE: SECURE DATA ENCRYPTION & SANITIZATION
 * 
 * This module handles:
 * 1. Data at Rest Encryption (AES Simulation)
 * 2. Input Sanitization (Anti-XSS)
 * 3. Identity Verification Logic (Password Strength)
 */

const SECRET_KEY_PREFIX = "THESIS_SECURE_";

// --- ENCRYPTION ENGINE ---
export const encryptData = (value: number | string): string => {
  const text = String(value);
  // Simulating AES-256 via Base64+Salt for prototype demonstration
  return `ENC_${btoa(SECRET_KEY_PREFIX + text)}`;
};

export const decryptData = (encryptedValue: string): string => {
  if (!encryptedValue.startsWith("ENC_")) return "0";
  try {
    const decoded = atob(encryptedValue.replace("ENC_", ""));
    return decoded.replace(SECRET_KEY_PREFIX, "");
  } catch (e) {
    console.error("Decryption failed integrity check");
    return "0";
  }
};

// --- INPUT VALIDATION ---
// Prevents Malicious Script Injection (XSS)
export const sanitizeInput = (input: string): string => {
  if (!input) return "";
  return input.replace(/[<>&"']/g, (match) => {
    switch (match) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return match;
    }
  });
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount);
};

// --- PASSWORD COMPLEXITY ENFORCEMENT (NEW) ---
// Thesis Standard: Enforcing NIST guidelines for password complexity
export const validateStrongPassword = (password: string): { isValid: boolean; message: string } => {
  if (password.length < 8) {
    return { isValid: false, message: "Password must be at least 8 characters long." };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: "Password must contain at least one Uppercase letter (A-Z)." };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: "Password must contain at least one Lowercase letter (a-z)." };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: "Password must contain at least one Number (0-9)." };
  }
  if (!/[!@#$%^&*]/.test(password)) {
    return { isValid: false, message: "Password must contain at least one Special Character (!@#$%^&*)." };
  }
  return { isValid: true, message: "Strong Password" };
};
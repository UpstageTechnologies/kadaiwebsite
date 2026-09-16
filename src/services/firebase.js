import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithPhoneNumber,
  updateProfile,
  RecaptchaVerifier,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  serverTimestamp,
  where,
  onSnapshot,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || "",
};

const firebaseRequiredEnv = [
  ["apiKey", "VITE_FIREBASE_API_KEY"],
  ["authDomain", "VITE_FIREBASE_AUTH_DOMAIN"],
  ["projectId", "VITE_FIREBASE_PROJECT_ID"],
  ["storageBucket", "VITE_FIREBASE_STORAGE_BUCKET"],
  ["messagingSenderId", "VITE_FIREBASE_MESSAGING_SENDER_ID"],
  ["appId", "VITE_FIREBASE_APP_ID"],
];

export const firebaseMissingConfig = () => {
  const missing = firebaseRequiredEnv
    .filter(([, envName]) => !import.meta.env?.[envName])
    .map(([, envName]) => envName);

  const encoded = firebaseRequiredEnv
    .filter(([key, envName]) => {
      const value = firebaseConfig[key] || "";
      return !value || value.trim().startsWith("YOUR_") || !import.meta.env?.[envName];
    })
    .map(([, envName]) => envName);

  return [...new Set([...missing, ...encoded])];
};

export const isFirebaseConfigured = () => firebaseMissingConfig().length === 0;

const firebaseApp = isFirebaseConfigured()
  ? getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null;

console.log("[FIRESTORE] Firebase app init:", firebaseApp ? "ready" : "not configured");

export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;

console.log("[FIRESTORE] Firestore db object:", db ? "ready" : "missing");

if (firebaseApp && auth) {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Firebase auth persistence setup failed:", error);
  });
}

export const requireFirebaseAuth = () => {
  if (!isFirebaseConfigured() || !auth) {
    throw new Error("Firebase auth is not configured. Check your VITE_FIREBASE_* environment variables.");
  }
  return auth;
};

export const firebaseConfigDiagnosticMessage = () => {
  const missing = firebaseMissingConfig();
  if (!missing.length) {
    return "";
  }

  return `Firebase configuration is incomplete. Missing Vite environment variable(s): ${missing.join(", ")}. Add the correct Firebase Web App values from the Firebase Console and restart Vite.`;
};

let phoneVerifier = null;
let phoneOtpInProgress = false;

const getRecaptchaContainer = () => {
  if (typeof document === "undefined") {
    return null;
  }

  return document.getElementById("recaptcha-container");
};

export const firebaseIsPhoneOtpInProgress = () => phoneOtpInProgress;
export const firebaseSetPhoneOtpInProgress = (value) => {
  phoneOtpInProgress = Boolean(value);
};

export const firebaseCreatePhoneVerifier = async () => {
  if (!isFirebaseConfigured() || !auth) {
    throw new Error(
      "Firebase auth is not configured. Check your VITE_FIREBASE_* environment variables."
    );
  }

  const container = getRecaptchaContainer();

  if (!container) {
    throw new Error("reCAPTCHA container is missing.");
  }

  // Always remove an old verifier before creating a new one
  firebaseClearPhoneVerifier();

  try {
    const verifier = new RecaptchaVerifier(auth, container, {
      size: "normal",

      callback: (response) => {
        console.log(
          "[RECAPTCHA] Verification successful:",
          Boolean(response)
        );
      },

      "expired-callback": () => {
        console.warn("[RECAPTCHA] Token expired.");
        firebaseClearPhoneVerifier();
      },

      "error-callback": (error) => {
        console.error("[RECAPTCHA] Verification error:", error);
        firebaseClearPhoneVerifier();
      },
    });

    phoneVerifier = verifier;

    const widgetId = await verifier.render();

    console.log("[RECAPTCHA] Widget rendered successfully:", widgetId);

    return verifier;
  } catch (error) {
    console.error(
      "[RECAPTCHA] Verifier initialization failed:",
      error
    );

    firebaseClearPhoneVerifier();

    const wrapped = new Error(
      "Unable to initialize device verification. Please refresh the page and try again.",
      { cause: error }
    );

    wrapped.code = error?.code || "";

    throw wrapped;
  }
};

export const firebaseClearPhoneVerifier = () => {
  if (!phoneVerifier) {
    return;
  }

  try {
    if (typeof phoneVerifier.clear === "function") {
      phoneVerifier.clear();
    }
  } catch (error) {
    console.error("Phone verifier cleanup warning:", error);
  }

  phoneVerifier = null;
};

export const firebaseSendPhoneOtp = async (phoneNumber, verifier) => {
  if (!isFirebaseConfigured() || !auth) {
    throw new Error("Firebase auth is not configured. Check your VITE_FIREBASE_* environment variables.");
  }

  if (phoneOtpInProgress) {
    throw new Error("OTP request already in progress.");
  }

  if (!verifier || typeof verifier.render !== "function" || typeof verifier.clear !== "function") {
    throw new Error("Unable to verify this device. Please try again.");
  }

  phoneOtpInProgress = true;

  try {
    console.log("[OTP] Starting signInWithPhoneNumber...");
    console.log("[OTP] Phone:", phoneNumber);
    console.log("[OTP] Verifier:", verifier);
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    console.log("[OTP] SMS request completed successfully.");
    console.log("[OTP] Confirmation result received:", !!confirmationResult);
    return confirmationResult;
  } catch (error) {
      console.error("[OTP] Firebase error:", error);
      console.error("[OTP] Firebase error code:", error?.code);
      console.error("[OTP] Firebase error message:", error?.message);

    firebaseClearPhoneVerifier();

    const mapped = normalizePhoneOtpError(error);
    if (mapped) {
      const wrapped = new Error(mapped, { cause: error });
      wrapped.code = error?.code || "";
      throw wrapped;
    }

    throw new Error(error?.message || "Unable to send OTP. Please try again.", { cause: error });
  } finally {
    phoneOtpInProgress = false;
  }
};

export const normalizePhoneOtpError = (error) => {
  const code = error?.code || error?.cause?.code || "";
  const detail = error?.cause?.message || error?.message || "";
  const exposedDetail = detail ? ` Firebase detail: ${detail}` : "";

  if (code === "auth/invalid-app-credential") {
    return `Unable to verify this device. Please refresh the page and try again. If the problem persists, verify Firebase Console: Authentication > Sign-in method > Phone, plus the authorized domains and Firebase Web App configuration. Code: ${code}.${exposedDetail}`;
  }
  if (code === "auth/billing-not-enabled") {
    return `Firebase Phone Authentication is not enabled for this project because billing is not active in the Firebase Console. Enable billing and turn on Phone Authentication in Firebase Console, then retry. Code: ${code}.${exposedDetail}`;
  }
  if (code === "auth/too-many-requests") return `Too many OTP attempts. Please wait a while before trying again. Code: ${code}.${exposedDetail}`;
  if (code === "auth/invalid-phone-number") return `Please enter a valid Indian mobile number. Code: ${code}.${exposedDetail}`;
  if (code === "auth/quota-exceeded") return `OTP service limit reached. Please try again later. Code: ${code}.${exposedDetail}`;
  if (code === "auth/network-request-failed") return `Network error. Please check your internet connection and try again. Code: ${code}.${exposedDetail}`;
  if (code === "auth/captcha-check-failed") return `Unable to verify this device. Please refresh the page and try again. Code: ${code}.${exposedDetail}`;
  if (code === "auth/missing-phone-number") return `Please enter a mobile number. Code: ${code}.${exposedDetail}`;
  if (code === "auth/invalid-verification-code") return `Invalid OTP. Please enter the 6-digit code exactly as received. Code: ${code}.${exposedDetail}`;
  if (code === "auth/code-expired") return `The OTP has expired. Request a new OTP. Code: ${code}.${exposedDetail}`;

  return `Unable to send OTP. Please try again. Code: ${code || "unknown"}.${exposedDetail}`;
};

export const firebaseUpdateDisplayName = async (uid, displayName) => {
  if (!auth || !auth.currentUser) {
    return null;
  }
  return updateProfile(auth.currentUser, { displayName });
};

export { updateProfile };

export const firebaseCustomerDoc = (uid) => {
  if (!db) {
    console.error("[FIRESTORE] firebaseCustomerDoc attempted before Firestore initialization.");
    return null;
  }

  if (!uid) {
    console.error("[FIRESTORE] firebaseCustomerDoc missing customer uid.");
    return null;
  }

  try {
    return doc(db, "customers", uid);
  } catch (error) {
    console.error("[FIRESTORE] firebaseCustomerDoc failed:", error);
    return null;
  }
};

export const firebaseFindCustomerByMobile = async (mobile) => {
  if (!db) {
    const unavailable = new Error("Firebase Firestore is temporarily unavailable. Please check your connection and try again.");
    unavailable.code = "firestore/unavailable";
    throw unavailable;
  }

  const normalizedMobile = String(mobile || "").replace(/\D/g, "");
  if (normalizedMobile.length !== 10) {
    throw new Error("Please enter a valid 10-digit Indian mobile number.");
  }

  try {
    const customerQuery = query(
      collection(db, "customers"),
      where("mobile", "==", `+91${normalizedMobile}`)
    );
    const snapshot = await getDocs(customerQuery);
    if (snapshot.empty) return null;

    const customerDocument = snapshot.docs[0];
    const customer = customerDocument.data() || {};
    return {
      ...customer,
      uid: customer.uid || customerDocument.id,
      mobile: customer.mobile || `+91${normalizedMobile}`,
    };
  } catch (error) {
    console.error("[FIRESTORE] Customer mobile lookup failed:", error?.code || error?.message || error);
    const friendly = new Error("Firebase Firestore is temporarily unavailable. Please check your connection and try again.");
    friendly.code = error?.code || "firestore/read-failed";
    throw friendly;
  }
};

export const firebaseCustomerSnapshot = async (uid) => {
  if (!auth?.currentUser) {
    const expired = new Error("Your verification session has expired. Please verify your mobile number again.");
    expired.code = "auth/session-expired";
    throw expired;
  }

  if (!db) {
    const unavailable = new Error("Firebase Firestore is temporarily unavailable. Please check your connection and try again.");
    unavailable.code = "firestore/unavailable";
    throw unavailable;
  }

  const customerRef = firebaseCustomerDoc(uid);
  if (!customerRef) {
    const unavailable = new Error("Firebase Firestore is temporarily unavailable. Please check your connection and try again.");
    unavailable.code = "firestore/unavailable";
    throw unavailable;
  }

  try {
    console.log("[FIRESTORE] Reading customer document:", uid);
    return await getDoc(customerRef);
  } catch (error) {
    console.error("[FIRESTORE] firebaseCustomerSnapshot failed:", error?.code || error?.message || error);
    const friendly = new Error("Firebase Firestore is temporarily unavailable. Please check your connection and try again.");
    friendly.code = error?.code || "firestore/read-failed";
    throw friendly;
  }
};

export const firebaseUpsertCustomerProfile = async (uid, data) => {
  if (!auth?.currentUser) {
    const expired = new Error("Your verification session has expired. Please verify your mobile number again.");
    expired.code = "auth/session-expired";
    throw expired;
  }

  if (!db) {
    const unavailable = new Error("Firebase Firestore is temporarily unavailable. Please check your connection and try again.");
    unavailable.code = "firestore/unavailable";
    throw unavailable;
  }

  const customerRef = firebaseCustomerDoc(uid);
  if (!customerRef) {
    const unavailable = new Error("Firebase Firestore is temporarily unavailable. Please check your connection and try again.");
    unavailable.code = "firestore/unavailable";
    throw unavailable;
  }

  try {
    console.log("[FIRESTORE] Writing customer document:", uid);
    const existing = await getDoc(customerRef);
    const existingData = existing.exists() ? existing.data() || {} : {};

    const payload = {
      ...data,
      createdAt: existingData.createdAt || data.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    return await setDoc(customerRef, payload, { merge: true });
  } catch (error) {
    console.error("[FIRESTORE] firebaseUpsertCustomerProfile failed:", error?.code || error?.message || error);
    const friendly = new Error("Firebase Firestore is temporarily unavailable. Please check your connection and try again.");
    friendly.code = error?.code || "firestore/write-failed";
    throw friendly;
  }
};

export const firebaseUpdateCustomer = async (uid, data) => {
  if (!auth?.currentUser) {
    const expired = new Error("Your verification session has expired. Please verify your mobile number again.");
    expired.code = "auth/session-expired";
    throw expired;
  }

  if (!db) {
    const unavailable = new Error("Firebase Firestore is temporarily unavailable. Please check your connection and try again.");
    unavailable.code = "firestore/unavailable";
    throw unavailable;
  }

  const customerRef = firebaseCustomerDoc(uid);
  if (!customerRef) {
    const unavailable = new Error("Firebase Firestore is temporarily unavailable. Please check your connection and try again.");
    unavailable.code = "firestore/unavailable";
    throw unavailable;
  }

  try {
    console.log("[FIRESTORE] Updating customer document:", uid);
    return await setDoc(customerRef, data, { merge: true });
  } catch (error) {
    console.error("[FIRESTORE] firebaseUpdateCustomer failed:", error?.code || error?.message || error);
    const friendly = new Error("Firebase Firestore is temporarily unavailable. Please check your connection and try again.");
    friendly.code = error?.code || "firestore/write-failed";
    throw friendly;
  }
};

export const firebaseSaveFcmToken = async () => {
  return "";
};

export { onSnapshot, doc, getDoc, setDoc };


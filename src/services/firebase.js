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
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";

export const firebaseConfig = {
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

export const firebaseApp = isFirebaseConfigured()
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
let phoneVerifierContainer = null;
let phoneVerifierPromise = null;
let phoneVerifierGeneration = 0;
let phoneOtpInProgress = false;

const getRecaptchaContainer = (containerId = "recaptcha-container") => {
  if (typeof document === "undefined") {
    return null;
  }

  const container = document.getElementById(containerId);
  return container?.isConnected ? container : null;
};

export const firebaseIsPhoneOtpInProgress = () => phoneOtpInProgress;
export const firebaseSetPhoneOtpInProgress = (value) => {
  phoneOtpInProgress = Boolean(value);
};

export const firebaseCreatePhoneVerifier = async (containerId = "recaptcha-container") => {
  if (!isFirebaseConfigured() || !auth) {
    throw new Error(
      "Firebase auth is not configured. Check your VITE_FIREBASE_* environment variables."
    );
  }

  const container = getRecaptchaContainer(containerId);

  if (!container) {
    throw new Error("The device verification box is not ready. Please try again.");
  }

  if (phoneVerifier && phoneVerifierContainer === container) {
    return phoneVerifierPromise || phoneVerifier;
  }

  firebaseClearPhoneVerifier();

  let verifier = null;

  try {
    verifier = new RecaptchaVerifier(auth, container, {
      size: "normal",

      callback: (response) => {
        console.log(
          "[RECAPTCHA] Verification successful:",
          Boolean(response)
        );
      },

      "expired-callback": () => {
        console.warn("[RECAPTCHA] Token expired.");
        if (phoneVerifier === verifier) firebaseClearPhoneVerifier();
      },

      "error-callback": (error) => {
        console.error("[RECAPTCHA] Verification error:", error);
        if (phoneVerifier === verifier) firebaseClearPhoneVerifier();
      },
    });

    phoneVerifier = verifier;
    phoneVerifierContainer = container;
    const generation = phoneVerifierGeneration;
    const renderPromise = verifier.render().then((widgetId) => {
      if (generation !== phoneVerifierGeneration || phoneVerifier !== verifier) {
        verifier.clear();
        throw new Error("The device verification box was closed. Please try again.");
      }

      console.log("[RECAPTCHA] Widget rendered successfully:", widgetId);
      return verifier;
    });
    phoneVerifierPromise = renderPromise;

    return await renderPromise;
  } catch (error) {
    console.error(
      "[RECAPTCHA] Verifier initialization failed:",
      error
    );

    if (phoneVerifier === verifier) {
      firebaseClearPhoneVerifier();
    } else if (verifier) {
      verifier.clear();
    }

    const wrapped = new Error(
      "Unable to initialize device verification. Please refresh the page and try again.",
      { cause: error }
    );

    wrapped.code = error?.code || "";

    throw wrapped;
  }
};

export const firebaseClearPhoneVerifier = () => {
  phoneVerifierGeneration += 1;
  phoneVerifierPromise = null;

  if (!phoneVerifier) {
    phoneVerifierContainer = null;
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
  phoneVerifierContainer = null;
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

export const firebaseCustomerSnapshot = async (uid) => {
  const authenticatedUid = auth?.currentUser?.uid || "";

  if (!authenticatedUid) {
    const expired = new Error("Your Firebase session is missing. Please log in again.");
    expired.code = "auth/session-expired";
    throw expired;
  }

  if (uid && String(uid) !== String(authenticatedUid)) {
    const mismatch = new Error("You can only read your own customer profile.");
    mismatch.code = "auth/uid-mismatch";
    throw mismatch;
  }

  const customerUid = authenticatedUid;

  if (!db) {
    const unavailable = new Error("Firebase Firestore is temporarily unavailable. Please check your connection and try again.");
    unavailable.code = "firestore/unavailable";
    throw unavailable;
  }

  const customerRef = firebaseCustomerDoc(customerUid);
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
  const authenticatedUser = auth?.currentUser;
  const customerUid = authenticatedUser?.uid || "";

  if (!customerUid) {
    const expired = new Error("Your verification session has expired. Please verify your mobile number again.");
    expired.code = "auth/session-expired";
    throw expired;
  }

  if (uid && uid !== customerUid) {
    const mismatch = new Error("You can only create or update your own customer profile.");
    mismatch.code = "auth/uid-mismatch";
    throw mismatch;
  }

  if (!authenticatedUser.phoneNumber) {
    const missingPhone = new Error("The verified mobile number is unavailable. Please verify your mobile number again.");
    missingPhone.code = "auth/phone-number-missing";
    throw missingPhone;
  }

  if (!db) {
    const unavailable = new Error("Firebase Firestore is temporarily unavailable. Please check your connection and try again.");
    unavailable.code = "firestore/unavailable";
    throw unavailable;
  }

  const customerRef = firebaseCustomerDoc(customerUid);
  if (!customerRef) {
    const unavailable = new Error("Firebase Firestore is temporarily unavailable. Please check your connection and try again.");
    unavailable.code = "firestore/unavailable";
    throw unavailable;
  }

  try {
    console.log("[FIRESTORE] Writing customer document:", customerUid);
    const existing = await getDoc(customerRef);
    const existingData = existing.exists() ? existing.data() || {} : {};

    const payload = {
      ...data,
      uid: customerUid,
      mobile: authenticatedUser.phoneNumber,
      createdAt: existingData.createdAt || data.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    return await setDoc(customerRef, payload, { merge: true });
  } catch (error) {
    console.error("[FIRESTORE] firebaseUpsertCustomerProfile failed:", error?.code || error?.message || error);
    throw error;
  }
};

export const firebaseUpdateCustomer = async (uid, data) => {
  const authUser = auth?.currentUser || null;
  const authenticatedUid = authUser?.uid || "";

  console.log("[ADDRESS DEBUG] auth.currentUser:", authUser);
  console.log("[ADDRESS DEBUG] auth.currentUser exists:", !!authUser);
  console.log("[ADDRESS DEBUG] auth UID:", authenticatedUid);

  if (!authUser || !authenticatedUid) {
    const expired = new Error("Your Firebase session is missing. Please log in again.");
    expired.code = "auth/session-expired";
    throw expired;
  }

  if (uid && String(uid) !== String(authenticatedUid)) {
    const mismatch = new Error("You can only update your own customer profile.");
    mismatch.code = "auth/uid-mismatch";
    throw mismatch;
  }

  const nextAddress = data?.address;
  if (!nextAddress || typeof nextAddress !== "object" || Array.isArray(nextAddress)) {
    const invalidAddress = new Error("Please provide a valid address before saving.");
    invalidAddress.code = "firestore/invalid-address";
    throw invalidAddress;
  }

  const customerUid = authenticatedUid;

  if (!db) {
    const unavailable = new Error("Firebase Firestore is temporarily unavailable. Please check your connection and try again.");
    unavailable.code = "firestore/unavailable";
    throw unavailable;
  }

  const customerRef = firebaseCustomerDoc(customerUid);
  if (!customerRef) {
    const unavailable = new Error("Firebase Firestore is temporarily unavailable. Please check your connection and try again.");
    unavailable.code = "firestore/unavailable";
    throw unavailable;
  }

  try {
    console.log("[ADDRESS DEBUG] customer document path:", `customers/${customerUid}`);
    await updateDoc(customerRef, { address: nextAddress });
    console.log("[ADDRESS DEBUG] successful customer update:", `customers/${customerUid}`);
    return true;
  } catch (error) {
    console.error("[FIRESTORE] firebaseUpdateCustomer failed:", error?.code || error?.message || error);

    const friendly = new Error(error?.message || "Unable to update your address. Please try again.");
    friendly.code = error?.code || "firestore/write-failed";
    throw friendly;
  }
};

export const firebaseSaveFcmToken = async () => {
  return "";
};

export { onSnapshot, doc, getDoc, setDoc };
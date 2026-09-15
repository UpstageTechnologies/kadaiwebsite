/**
 * Authentication Service
 * Handles all authentication-related logic and Firebase operations locally
 * while preventing plain-text password storage in localStorage or Firestore.
 */

const STORAGE_KEYS = {
  IS_LOGGED_IN: "isLoggedIn",
  REGISTERED_USER: "registeredUser",
  REMEMBERED_EMAIL: "rememberedEmail",
};

const normalizePhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length > 0) {
    return `+${digits}`;
  }
  return "";
};

const normalizePhoneTrimmed = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
};

const makePasswordHash = async (password) => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Secure password hashing is not available in this browser.");
  }

  const data = new TextEncoder().encode(password);
  const digest = await subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const verifyPasswordHash = async (password, saltlessHash) => {
  const hash = await makePasswordHash(password);
  return hash === saltlessHash;
};

export const registerUser = async (userData) => {
  try {
    const { fullName = "", email = "", phone = "", password = "" } = userData || {};

    if (!phone || !password) {
      throw new Error("Phone number and password are required.");
    }

    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length !== 10) {
      throw new Error("Please enter a valid 10-digit Indian mobile number.");
    }

    const passwordStrength = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordStrength.test(password)) {
      throw new Error("Password must include 8+ characters with uppercase, lowercase, number, and symbol.");
    }

    const formattedPhone = normalizePhone(phone);
    const passwordHash = await makePasswordHash(password);

    const user = {
      fullName,
      email,
      phone: formattedPhone,
      passwordHash,
      registeredAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEYS.REGISTERED_USER, JSON.stringify(user));
    return user;
  } catch (error) {
    console.error("[AUTH] Registration error:", error);
    return null;
  }
};

export const loginUser = async (phone, password) => {
  try {
    const savedUserData = localStorage.getItem(STORAGE_KEYS.REGISTERED_USER);

    if (!savedUserData) {
      throw new Error("User not found. Please register first.");
    }

    const savedUser = JSON.parse(savedUserData);
    const inputPhone = normalizePhoneTrimmed(phone);

    if (savedUser.phone !== inputPhone) {
      throw new Error("Invalid phone number or password.");
    }

    const passwordMatches = await verifyPasswordHash(password, savedUser.passwordHash);
    if (!passwordMatches) {
      throw new Error("Invalid phone number or password.");
    }

    localStorage.setItem(STORAGE_KEYS.IS_LOGGED_IN, "true");
    localStorage.setItem("isLoggedIn", "true");
    return savedUser;
  } catch (error) {
    console.error("[AUTH] Login error:", error);
    return null;
  }
};

export const logoutUser = () => {
  localStorage.removeItem(STORAGE_KEYS.IS_LOGGED_IN);
  localStorage.removeItem("isLoggedIn");
};

export const getCurrentUser = () => {
  try {
    const isLoggedIn = localStorage.getItem(STORAGE_KEYS.IS_LOGGED_IN) === "true";
    const userDataString = localStorage.getItem(STORAGE_KEYS.REGISTERED_USER);

    if (isLoggedIn && userDataString) {
      return JSON.parse(userDataString);
    }

    return null;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
};

export const isAuthenticated = () => {
  return localStorage.getItem(STORAGE_KEYS.IS_LOGGED_IN) === "true";
};

export const getUserFullName = () => {
  try {
    const savedUser = localStorage.getItem(STORAGE_KEYS.REGISTERED_USER);

    if (savedUser) {
      const user = JSON.parse(savedUser);
      return user.fullName || "";
    }

    return "";
  } catch (error) {
    console.error("Error getting user full name:", error);
    return "";
  }
};

export const saveRememberedEmail = (email) => {
  if (email) {
    localStorage.setItem(STORAGE_KEYS.REMEMBERED_EMAIL, email);
  }
};

export const getRememberedEmail = () => {
  return localStorage.getItem(STORAGE_KEYS.REMEMBERED_EMAIL) || "";
};

export const clearRememberedEmail = () => {
  localStorage.removeItem(STORAGE_KEYS.REMEMBERED_EMAIL);
};

export const normalizePhoneNumber = normalizePhone;

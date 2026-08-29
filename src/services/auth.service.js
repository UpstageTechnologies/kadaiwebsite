/**
 * Authentication Service
 * Handles all authentication-related logic and Firebase operations
 */

const STORAGE_KEYS = {
  IS_LOGGED_IN: "isLoggedIn",
  REGISTERED_USER: "registeredUser",
  REMEMBERED_EMAIL: "rememberedEmail",
};

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @param {string} userData.fullName - User's full name
 * @param {string} userData.email - User's email
 * @param {string} userData.phone - User's phone number
 * @param {string} userData.password - User's password
 * @returns {Object} Registered user object or null if failed
 */
export const registerUser = (userData) => {
  try {
    const { fullName, email, phone, password } = userData;

    if (!fullName || !email || !phone || !password) {
      throw new Error("All fields are required");
    }

    const user = {
      fullName,
      email,
      phone,
      password,
      registeredAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEYS.REGISTERED_USER, JSON.stringify(user));
    return user;
  } catch (error) {
    console.error("Registration error:", error);
    return null;
  }
};

/**
 * Authenticate user login
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Object} User object or null if authentication fails
 */
export const loginUser = (email, password) => {
  try {
    const savedUserData = localStorage.getItem(STORAGE_KEYS.REGISTERED_USER);

    if (!savedUserData) {
      throw new Error("User not found. Please register first.");
    }

    const savedUser = JSON.parse(savedUserData);

    if (savedUser.email !== email) {
      throw new Error("Invalid email address.");
    }

    if (savedUser.password !== password) {
      throw new Error("Incorrect password.");
    }

    localStorage.setItem(STORAGE_KEYS.IS_LOGGED_IN, "true");
    return savedUser;
  } catch (error) {
    console.error("Login error:", error);
    return null;
  }
};

/**
 * Logout the current user
 */
export const logoutUser = () => {
  localStorage.removeItem(STORAGE_KEYS.IS_LOGGED_IN);
};

/**
 * Get current authenticated user
 * @returns {Object} User object or null if not logged in
 */
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

/**
 * Check if user is authenticated
 * @returns {boolean} True if user is logged in
 */
export const isAuthenticated = () => {
  return localStorage.getItem(STORAGE_KEYS.IS_LOGGED_IN) === "true";
};

/**
 * Get user's full name
 * @returns {string} User's full name or empty string
 */
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

/**
 * Save remembered email
 * @param {string} email - Email to remember
 */
export const saveRememberedEmail = (email) => {
  if (email) {
    localStorage.setItem(STORAGE_KEYS.REMEMBERED_EMAIL, email);
  }
};

/**
 * Get remembered email
 * @returns {string} Remembered email or empty string
 */
export const getRememberedEmail = () => {
  return localStorage.getItem(STORAGE_KEYS.REMEMBERED_EMAIL) || "";
};

/**
 * Clear remembered email
 */
export const clearRememberedEmail = () => {
  localStorage.removeItem(STORAGE_KEYS.REMEMBERED_EMAIL);
};

/**
 * Login Feature Service
 * Handles login-specific logic
 */

import { login as authLogin, saveRememberedEmail } from "../../services/auth.service";

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {Object} Validation result
 */
export const validateEmail = (email) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return {
    valid: emailPattern.test(email),
    error: !emailPattern.test(email) ? "Invalid email format" : null,
  };
};

/**
 * Validate password
 * @param {string} password - Password to validate
 * @returns {Object} Validation result
 */
export const validatePassword = (password) => {
  return {
    valid: password && password.length >= 6,
    error: password && password.length < 6 ? "Password must be at least 6 characters" : null,
  };
};

/**
 * Perform login
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {boolean} rememberMe - Remember email
 * @returns {Object} Login result
 */
export const performLogin = (email, password, rememberMe = false) => {
  const user = authLogin(email, password);

  if (user) {
    if (rememberMe) {
      saveRememberedEmail(email);
    }
    return { success: true, user };
  }

  return {
    success: false,
    error: "Invalid email or password",
  };
};

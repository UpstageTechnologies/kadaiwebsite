/**
 * Register Feature Service
 * Handles registration-specific logic
 */

import { register as authRegister } from "../../services/auth.service";

/**
 * Validate registration data
 * @param {Object} data - User data
 * @returns {Object} Validation result
 */
export const validateRegistrationData = (data) => {
  const { fullName, email, phone, password, confirmPassword, agreeTerms } = data;

  if (!fullName?.trim()) {
    return { valid: false, error: "Full name is required" };
  }

  if (fullName.trim().length < 3) {
    return { valid: false, error: "Name must be at least 3 characters" };
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return { valid: false, error: "Invalid email format" };
  }

  const phonePattern = /^[0-9]{10}$/;
  if (!phonePattern.test(phone)) {
    return { valid: false, error: "Phone must be 10 digits" };
  }

  if (!password || password.length < 6) {
    return { valid: false, error: "Password must be at least 6 characters" };
  }

  if (password !== confirmPassword) {
    return { valid: false, error: "Passwords do not match" };
  }

  if (!agreeTerms) {
    return { valid: false, error: "You must agree to the terms" };
  }

  return { valid: true };
};

/**
 * Perform user registration
 * @param {Object} userData - User registration data
 * @returns {Object} Registration result
 */
export const performRegistration = (userData) => {
  const validation = validateRegistrationData(userData);

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const user = authRegister(userData);
  return { success: true, user };
};

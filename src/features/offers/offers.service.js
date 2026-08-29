/**
 * Offers Feature Service
 * Handles special offers logic
 */

import { offers } from "../../data/offers";

/**
 * Get all active offers
 * @returns {Array} Array of offers
 */
export const getAllOffers = () => {
  return offers;
};

/**
 * Get offer by ID
 * @param {number|string} id - Offer ID
 * @returns {Object} Offer object or null
 */
export const getOfferById = (id) => {
  return offers.find((offer) => String(offer.id) === String(id));
};

/**
 * Calculate discount percentage
 * @param {number} originalPrice - Original price
 * @param {number} discountedPrice - Discounted price
 * @returns {number} Discount percentage
 */
export const calculateDiscountPercentage = (originalPrice, discountedPrice) => {
  if (originalPrice === 0) return 0;
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
};

/**
 * Product Detail Feature Service
 * Handles product detail page logic
 */

import { products } from "../../data/category";

/**
 * Get product by ID
 * @param {number|string} id - Product ID
 * @returns {Object} Product details or null
 */
export const getProductById = (id) => {
  return products.find((item) => String(item.id) === String(id));
};

/**
 * Get related products
 * @param {string} category - Product category
 * @param {number} limit - Number of related products
 * @returns {Array} Related products
 */
export const getRelatedProducts = (category, limit = 4) => {
  return products
    .filter((p) => p.category === category)
    .slice(0, limit);
};

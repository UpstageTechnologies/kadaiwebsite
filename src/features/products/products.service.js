/**
 * Products Feature Service
 * Handles Products page business logic, filtering, searching
 */

import { products, categories } from "../../data/category";

/**
 * Get all products
 */
export const getAllProducts = () => {
  return products;
};

/**
 * Get all product categories
 */
export const getCategories = () => {
  return categories;
};

/**
 * Filter products by category
 * @param {string} category - Category name
 * @returns {Array} Filtered products
 */
export const filterProductsByCategory = (category) => {
  if (category === "All Products") {
    return products;
  }
  return products.filter((product) => product.category === category);
};

/**
 * Search products by query
 * @param {string} query - Search query
 * @returns {Array} Matching products
 */
export const searchProducts = (query) => {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return products;

  return products.filter(
    (product) =>
      product.name.toLowerCase().includes(lowerQuery) ||
      product.category.toLowerCase().includes(lowerQuery) ||
      product.description.toLowerCase().includes(lowerQuery)
  );
};

/**
 * Get product count by category
 */
export const getProductCountByCategory = (category) => {
  if (category === "All Products") return products.length;
  return products.filter((p) => p.category === category).length;
};

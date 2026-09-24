/**
 * Products Feature Service
 * Handles Products page business logic, filtering, searching
 */

import { products } from "../../data/category";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../services/firebase";

const CATEGORY_COLLECTION_PATH = [
  "users",
  "9Hki1DyPmhc621MwXQQKZYlkdf53",
  "categories",
];

/**
 * Get all products
 */
export const getAllProducts = () => {
  return products;
};

/**
 * Get all product categories
 */
export const getCategories = async () => {
  if (!db) return [];

  const snapshot = await getDocs(
    collection(db, ...CATEGORY_COLLECTION_PATH)
  );

  return snapshot.docs
    .map((categorySnapshot) => categorySnapshot.data()?.name)
    .filter((name) => typeof name === "string" && name.trim())
    .map((name) => name.trim());
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

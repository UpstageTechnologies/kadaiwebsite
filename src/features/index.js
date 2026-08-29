/**
 * Features Index
 * Central re-export point for all features
 * Makes importing features cleaner: import { Home, Products } from 'src/features'
 */

// Home Feature
export { default as Home } from "./home";
export * from "./home/home.service";

// Products Feature
export { default as Products } from "./products";
export * from "./products/products.service";

// Product Detail Feature
export { default as ProductDetail } from "./product-detail";
export * from "./product-detail/product-detail.service";

// Cart Feature
export { default as Cart } from "./cart";
export * from "./cart/cart.service";

// Offers Feature
export { default as Offers } from "./offers";
export * from "./offers/offers.service";

// Auth Features
export { default as Login } from "./auth/login";
export { default as Register } from "./auth/register";
export * from "./auth/login/login.service";
export * from "./auth/register/register.service";

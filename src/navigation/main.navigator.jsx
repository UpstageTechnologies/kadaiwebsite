import { Routes, Route } from "react-router-dom";
import Home from "../features/home";
import Products from "../features/products";
import Cart from "../features/cart";
import Login from "../features/auth/login";
import Register from "../features/auth/register";
import ProductDetail from "../features/product-detail";
import Offers from "../features/offers";

/**
 * Main Navigator
 * Handles all main application routes (Home, Products, Cart, Offers, etc.)
 * Available to both authenticated and unauthenticated users
 */
const MainNavigator = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/products" element={<Products />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/offers" element={<Offers />} />
      <Route path="/product/:id" element={<ProductDetail />} />
      
      {/* Fallback route */}
      <Route path="*" element={<Home />} />
    </Routes>
  );
};

export default MainNavigator;

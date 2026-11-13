import { Routes, Route, Navigate } from "react-router-dom";
import Products from "../features/products";
import Cart from "../features/cart";
import Login from "../features/auth/login";
import Register from "../features/auth/register";
import ProductDetail from "../features/product-detail";
import Checkout from "../features/checkout";
import Orders from "../features/orders";
import LocationPicker from "../features/location-picker";
import TrackOrder from "../features/track-order";
import Profile from "../features/profile";
import Experience from "../features/experience";
import Restaurants from "../features/restaurants";
import DeleteAccount from "../features/delete-account";

/**
 * Main Navigator
 * Handles all main application routes (Home, Products, Cart, Offers, etc.)
 * Available to both authenticated and unauthenticated users
 */
const MainNavigator = () => {
  return (
    <Routes>
      <Route path="/" element={<Experience />} />
      <Route path="/experience" element={<Experience />} />
      <Route path="/delete-account" element={<DeleteAccount />} />
      <Route path="/restaurants" element={<Restaurants />} />
      <Route path="/restaurants/cart" element={<Restaurants cartMode="cart" />} />
      <Route path="/restaurants/checkout" element={<Restaurants cartMode="checkout" />} />
      <Route path="/restaurants/orders" element={<Restaurants cartMode="orders" />} />
      <Route path="/restaurants/track-order/:orderId" element={<Restaurants cartMode="track-order" />} />
      <Route path="/restaurants/:restaurantId" element={<Restaurants />} />
      <Route path="/products" element={<Products />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register/otp" element={<Register />} />
      <Route path="/register/username" element={<Register />} />
      <Route path="/register/address" element={<Register />} />
      <Route path="/register/details" element={<Register />} />
      <Route path="/product/:id" element={<ProductDetail />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/track-order/:orderId" element={<TrackOrder />} />
      <Route path="/location-picker" element={<LocationPicker />} />

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default MainNavigator;

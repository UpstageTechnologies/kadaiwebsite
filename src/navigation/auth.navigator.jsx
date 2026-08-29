import { Routes, Route } from "react-router-dom";
import Login from "../features/auth/login";
import Register from "../features/auth/register";

/**
 * Auth Navigator
 * Handles authentication-related routes (Login, Register)
 */
const AuthNavigator = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Redirect unmatched auth routes to login */}
      <Route path="*" element={<Login />} />
    </Routes>
  );
};

export default AuthNavigator;

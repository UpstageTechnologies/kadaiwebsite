
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
import Home from "./pages/home";
import Product from "./pages/Products";
import Cart from "./pages/Cart";
import { CartProvider } from "./components/CardContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ScrollToTop from "./components/ScrollToTop";
import ProductCard from "./pages/ProductCard";
import Offers from "./pages/Offers";

const App = () => {
  return (
    <BrowserRouter>

    <ScrollToTop/>

    <CartProvider>

      <Routes>

        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/products"
          element={<Product />}
        />

        <Route
          path="/cart"
          element={<Cart/>}
        />

        <Route
          path="/login"
          element={<Login/>}
        />

        <Route
          path="/register"
          element={<Register/>}
        />

        <Route
          path="/offers"
          element={<Offers/>}
        />

        <Route
          path="/product/:id"
          element={<ProductCard/>}
        />


      </Routes>

      </CartProvider>

    </BrowserRouter>
  );
};

export default App;
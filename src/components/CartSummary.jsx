import { FiArrowRight, FiShoppingCart, FiX } from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import { useCart } from "./CardContext";
import "../index.css";

const CartSummary = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    cartCount,
    cartSummary,
    cartError,
    clearCartError,
  } = useCart();
  const isShoppingPage = pathname === "/"
    || pathname === "/products"
    || pathname.startsWith("/product/");

  if (!isShoppingPage || (!cartCount && !cartError)) {
    return null;
  }

  return (
    <aside className="cart-summary-dock" aria-label="Cart summary">
      {cartError && (
        <div className="cart-summary-error" role="alert">
          <span>{cartError}</span>
          <button type="button" aria-label="Dismiss cart error" onClick={clearCartError}>
            <FiX />
          </button>
        </div>
      )}
      {cartCount > 0 && (
        <button
          type="button"
          className="cart-summary-button"
          onClick={() => navigate("/cart")}
          aria-label={`${cartCount} items in cart, total ₹${cartSummary.total.toFixed(2)}. Open cart.`}
        >
          <span className="cart-summary-items">
            <FiShoppingCart aria-hidden="true" />
            <span>{cartCount} {cartCount === 1 ? "item" : "items"}</span>
          </span>
          <span className="cart-summary-total">
            ₹{cartSummary.total.toFixed(2)}
            <FiArrowRight aria-hidden="true" />
          </span>
        </button>
      )}
    </aside>
  );
};

export default CartSummary;

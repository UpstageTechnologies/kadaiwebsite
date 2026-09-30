import { useRef, useState } from "react";
import { FiArrowDown, FiArrowRight, FiShoppingCart, FiX } from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import { useCart } from "./CardContext";
import "../index.css";

const CartSummary = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    cartItems,
    cartCount,
    cartSummary,
    cartError,
    clearCartError,
  } = useCart();
  const [expanded, setExpanded] = useState(false);
  const dragStart = useRef(null);
  const suppressClick = useRef(false);
  const isShoppingPage = pathname === "/"
    || pathname === "/products"
    || pathname.startsWith("/product/");

  if (!isShoppingPage || (!cartCount && !cartError)) {
    return null;
  }

  const handlePointerDown = (event) => {
    dragStart.current = { x: event.clientX, y: event.clientY };
    suppressClick.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerUp = (event) => {
    if (!dragStart.current) return;
    const deltaX = event.clientX - dragStart.current.x;
    const deltaY = event.clientY - dragStart.current.y;
    dragStart.current = null;

    if (Math.abs(deltaY) < 36 || Math.abs(deltaY) < Math.abs(deltaX)) return;

    setExpanded(deltaY < 0);
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  };

  const openCart = () => {
    if (suppressClick.current) return;
    navigate("/cart");
  };

  const previewItems = cartItems.slice(0, 5);
  const extraItemCount = Math.max(0, cartItems.length - previewItems.length);

  return (
    <aside className={`cart-summary-dock${expanded ? " is-expanded" : ""}`} aria-label="Cart summary">
      {cartError && (
        <div className="cart-summary-error" role="alert">
          <span>{cartError}</span>
          <button type="button" aria-label="Dismiss cart error" onClick={clearCartError}>
            <FiX />
          </button>
        </div>
      )}
      {cartCount > 0 && (
        <>
          {expanded && (
            <section className="cart-preview-panel" aria-label="Cart products">
              <div
                className="cart-preview-panel-header"
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => { dragStart.current = null; }}
              >
                <span className="cart-preview-grab" aria-hidden="true" />
                <strong>Cart</strong>
                <button
                  type="button"
                  className="cart-preview-collapse"
                  aria-label="Collapse cart preview"
                  onClick={() => setExpanded(false)}
                >
                  <FiArrowDown aria-hidden="true" />
                </button>
              </div>

              <div className="cart-preview-list">
                {cartItems.map((item) => (
                  <div className="cart-preview-row" key={item.id}>
                    {item.image && <img src={item.image} alt={item.name} loading="lazy" />}
                    <span className="cart-preview-product">
                      <strong>{Number(item.quantity || 0)} × {item.name}</strong>
                      <small>₹{Number(item.price || 0).toFixed(2)} each</small>
                    </span>
                    <strong className="cart-preview-line-total">
                      ₹{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="cart-preview-totals">
                <div><span>Subtotal</span><strong>₹{cartSummary.subtotal.toFixed(2)}</strong></div>
                <div><span>Delivery</span><strong>₹{cartSummary.delivery.toFixed(2)}</strong></div>
                <div className="cart-preview-grand-total"><span>Total</span><strong>₹{cartSummary.total.toFixed(2)}</strong></div>
              </div>

              <button type="button" className="cart-preview-next" onClick={() => navigate("/cart")}>
                View cart and checkout <FiArrowRight aria-hidden="true" />
              </button>
            </section>
          )}

          <button
            type="button"
            className="cart-summary-button"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => { dragStart.current = null; }}
            onClick={openCart}
            aria-label={`${cartCount} items in cart, total ₹${cartSummary.total.toFixed(2)}. Drag up to preview or open cart.`}
          >
            <span className="cart-summary-label"><FiShoppingCart aria-hidden="true" />Cart</span>
            <span className="cart-summary-thumbnails" aria-hidden="true">
              {previewItems.map((item) => item.image ? (
                <img key={item.id} src={item.image} alt="" loading="lazy" />
              ) : null)}
              {extraItemCount > 0 && <span className="cart-summary-more">+{extraItemCount}</span>}
            </span>
            <span className="cart-summary-count">{cartCount}</span>
            <span className="cart-summary-total">₹{cartSummary.total.toFixed(2)}<FiArrowRight aria-hidden="true" /></span>
          </button>
        </>
      )}
    </aside>
  );
};

export default CartSummary;

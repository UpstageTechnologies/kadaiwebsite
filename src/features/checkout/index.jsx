import { useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiCheck, FiMapPin } from "react-icons/fi";
import { useLocation as useRouteLocation, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import AddressChangeModal from "../../components/AddressChangeModal";
import { useAuth } from "../../components/AuthContext";
import { useCart } from "../../components/CardContext";
import { calculateSubtotal } from "../cart/cart.service";
import { getPaymentMethodLabel, placeOrder } from "../orders/orders.service";

import "./checkout.css";

const PAYMENT_METHOD = {
  id: "cod",
  label: "Cash on Delivery",
  note: "Pay when your order arrives",
};

const Checkout = () => {
  const navigate = useNavigate();
  const routeLocation = useRouteLocation();
  const { cartItems, clearCart } = useCart();
  const { user, customer, loading: isAuthLoading } = useAuth();
  const [error, setError] = useState("");
  const [successOrder, setSuccessOrder] = useState(null);
  const [deliveryAddress, setDeliveryAddress] = useState(null);
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const isAuthenticated = Boolean(user);

  const summary = useMemo(() => {
    const subtotal = calculateSubtotal(cartItems);
    return { subtotal, delivery: 0, total: subtotal };
  }, [cartItems]);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(routeLocation.pathname)}`, {
        replace: true,
      });
    }
  }, [isAuthLoading, isAuthenticated, navigate, routeLocation.pathname]);

  const handleAddressSaved = (nextAddress) => {
    setDeliveryAddress({
      ...nextAddress,
      id: "checkout-delivery-address",
      label: "Delivery address",
      address: nextAddress.fullAddress || nextAddress.address,
    });
    setIsAddressFormOpen(false);
    setError("");
  };

  const handlePlaceOrder = async () => {
    if (!deliveryAddress) {
      setError("Please enter and save a delivery address.");
      return;
    }

    if (!summary.total || summary.total <= 0) {
      setError("Invalid or missing checkout amount.");
      return;
    }

    setIsPlacingOrder(true);
    setError("");

    try {
      const order = await placeOrder({
        cartItems,
        address: deliveryAddress,
        paymentMethod: "cod",
        summary,
        paymentStatus: "Pending",
        customerName: customer?.name || customer?.fullName || user?.displayName || "Customer",
      });

      if (!order) {
        setError("Order creation failed. Please try again.");
        return;
      }

      const cartCleared = await clearCart();
      if (!cartCleared) {
        setError("Your order was placed, but your cart could not be cleared. Please clear it before placing another order.");
      }
      setSuccessOrder(order);
    } catch (orderError) {
      console.error("[CHECKOUT] Order placement failed:", orderError);
      setError(orderError?.message || "Order creation failed. Please try again.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (isAuthLoading || !isAuthenticated) {
    return null;
  }

  if (successOrder) {
    return (
      <>
        <Navbar />
        <main className="checkout-page checkout-success-page">
          <section className="checkout-success">
            <div className="checkout-success-icon">
              <FiCheck />
            </div>
            <h1>Order Placed Successfully!</h1>
            {error && <p className="checkout-error" role="alert">{error}</p>}
            <div className="checkout-success-details">
              <div><span>Order ID:</span> <strong>{successOrder.id}</strong></div>
              <div><span>Payment Method:</span> <strong>{getPaymentMethodLabel(successOrder.paymentMethod)}</strong></div>
              <div><span>Amount:</span> <strong>₹{Number(successOrder.total || summary.total).toFixed(2)}</strong></div>
            </div>
            <button
              className="checkout-success-button"
              type="button"
              onClick={() => navigate("/products")}
            >
              Continue Shopping
            </button>
          </section>
        </main>
      </>
    );
  }

  if (cartItems.length === 0) {
    return (
      <>
        <Navbar />
        <main className="checkout-page checkout-empty">
          <h1>Your Cart is Empty</h1>
          <p>Add products before proceeding to checkout.</p>
          <button type="button" onClick={() => navigate("/products")}>
            Start Shopping
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="checkout-page">
        <button className="checkout-back" type="button" onClick={() => navigate("/cart")}>
          <FiArrowLeft /> Back to Cart
        </button>

        <header className="checkout-header">
          <span>SECURE CHECKOUT</span>
          <h1>Complete your order</h1>
          <p>Review your delivery details and choose how you would like to pay.</p>
        </header>

        <div className="checkout-layout">
          <section className="checkout-main">
            <div className="checkout-section">
              <div className="checkout-section-heading">
                <FiMapPin />
                <div>
                  <h2>Delivery address</h2>
                  <p>Choose where you want your order delivered</p>
                </div>
              </div>

              {deliveryAddress && !isAddressFormOpen && (
                <div className="selected-address-preview">
                  <div className="address-copy">
                    <strong>{deliveryAddress.label}</strong>
                    <span>{deliveryAddress.address}</span>
                  </div>
                  <div className="address-preview-actions">
                    <button
                      className="edit-address-btn"
                      type="button"
                      onClick={() => setIsAddressFormOpen(true)}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}

              <AddressChangeModal
                open={isAddressFormOpen}
                flow="checkout"
                initialAddress={deliveryAddress}
                onClose={() => setIsAddressFormOpen(false)}
                onSaved={handleAddressSaved}
              />

              {!deliveryAddress && !isAddressFormOpen && (
                <button
                  className="add-address-btn"
                  type="button"
                  onClick={() => setIsAddressFormOpen(true)}
                >
                  + Enter Delivery Address
                </button>
              )}
            </div>

            <div className="checkout-section">
              <div className="checkout-section-heading">
                <FiCheck />
                <div>
                  <h2>Payment method</h2>
                  <p>Select one option to place your order</p>
                </div>
              </div>
              <div className="payment-options">
                <div className="payment-option selected">
                  <span className="payment-radio" />
                  <span className="payment-copy">
                    <strong>{PAYMENT_METHOD.label}</strong>
                    <small>{PAYMENT_METHOD.note}</small>
                  </span>
                </div>
              </div>
              {error && <p className="checkout-error">{error}</p>}
            </div>
          </section>

          <aside className="checkout-summary">
            <h2>Order summary</h2>
            <div className="checkout-items">
              {cartItems.map((item) => (
                <div className="checkout-item" key={item.id}>
                  <span>{item.name} x {item.quantity}</span>
                  <strong>₹{(item.price * item.quantity).toFixed(2)}</strong>
                </div>
              ))}
            </div>
            <div className="summary-row"><span>Subtotal</span><strong>₹{summary.subtotal.toFixed(2)}</strong></div>
            <div className="summary-total"><span>Total</span><strong>₹{summary.total.toFixed(2)}</strong></div>
            <button className="place-order-btn" type="button" onClick={handlePlaceOrder} disabled={isPlacingOrder}>
              {isPlacingOrder ? "Placing Order..." : "Continue / Place Order"}
            </button>
          </aside>
        </div>
      </main>
    </>
  );
};

export default Checkout;
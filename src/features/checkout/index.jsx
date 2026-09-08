import { useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiCheck, FiMapPin } from "react-icons/fi";
import { useLocation as useRouteLocation, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { useCart } from "../../components/CardContext";
import { useLocation } from "../../components/LocationContext";
import { calculateSubtotal, calculateDeliveryCharge } from "../cart/cart.service";
import { getSavedOrders, saveOrder } from "../orders/orders.service";
import {
  getSavedAddresses,
  getSelectedAddress,
  saveAddress,
} from "./address.service";

import "./checkout.css";

const PAYMENT_METHODS = [
  { id: "razorpay", label: "Razorpay", note: "Online payment" },
  { id: "google-pay", label: "Google Pay", note: "Online payment" },
  { id: "cod", label: "Cash on Delivery", note: "Pay when your order arrives" },
];

const Checkout = () => {
  const navigate = useNavigate();
  const routeLocation = useRouteLocation();
  const { cartItems, clearCart } = useCart();
  const { location } = useLocation();
  const [paymentMethod, setPaymentMethod] = useState("");
  const [error, setError] = useState("");
  const [addresses, setAddresses] = useState(() => getSavedAddresses(location));
  const [address, setAddress] = useState(() =>
    getSelectedAddress(getSavedAddresses(location))
  );
  const [showAddressOptions, setShowAddressOptions] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState("");
  const [newAddressText, setNewAddressText] = useState("");

  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

  const summary = useMemo(() => {
    const subtotal = calculateSubtotal(cartItems);
    const delivery = calculateDeliveryCharge(subtotal);
    return { subtotal, delivery, total: subtotal + delivery };
  }, [cartItems]);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate(`/login?redirect=${encodeURIComponent(routeLocation.pathname)}`, {
        replace: true,
      });
    }
  }, [isLoggedIn, navigate, routeLocation.pathname]);

  const handleSelectAddress = (selectedAddress) => {
    setAddress(selectedAddress);
    saveAddress(selectedAddress);
    setShowAddressOptions(false);
    setError("");
  };

  const handleAddAddress = (event) => {
    event.preventDefault();

    if (!newAddressText.trim()) {
      setError("Please enter a delivery address.");
      return;
    }

    const newAddress = {
      id: `address-${Date.now()}`,
      label: newAddressLabel.trim() || "Home address",
      address: newAddressText.trim(),
      detectedAt: new Date().toISOString(),
    };

    saveAddress(newAddress);
    setAddresses((previousAddresses) => [newAddress, ...previousAddresses]);
    setAddress(newAddress);
    setNewAddressLabel("");
    setNewAddressText("");
    setShowAddressForm(false);
    setShowAddressOptions(false);
    setError("");
  };

  const handlePlaceOrder = () => {
    if (!paymentMethod) {
      setError("Please select a payment method to continue.");
      return;
    }

    if (!address) {
      setError("Please add a delivery address to continue.");
      return;
    }

    const savedOrders = getSavedOrders();
    const order = {
      id: `KADAI-${String(savedOrders.length + 1).padStart(4, "0")}`,
      items: cartItems,
      address,
      paymentMethod,
      subtotal: summary.subtotal,
      delivery: summary.delivery,
      total: summary.total,
      status: "Placed",
      createdAt: new Date().toISOString(),
    };

    saveOrder(order);
    clearCart();
    navigate("/orders");
  };

  if (!isLoggedIn) {
    return null;
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

              {address && !showAddressOptions && (
                <div className="selected-address-preview">
                  <div className="address-copy">
                    <strong>{address.label || "Selected address"}</strong>
                    <span>{address.address}</span>
                  </div>
                  <button
                    className="change-address-btn"
                    type="button"
                    onClick={() => setShowAddressOptions(true)}
                  >
                    Change address
                  </button>
                </div>
              )}

              {(!address || showAddressOptions) && addresses.length > 0 && (
                <div className="address-list">
                  {addresses.map((savedAddress) => (
                    <label
                      className={`saved-address ${address?.id === savedAddress.id ? "selected" : ""}`}
                      key={savedAddress.id}
                    >
                      <input
                        type="radio"
                        name="deliveryAddress"
                        checked={address?.id === savedAddress.id}
                        onChange={() => handleSelectAddress(savedAddress)}
                      />
                      <span className="address-radio" />
                      <span className="address-copy">
                        <strong>{savedAddress.label}</strong>
                        <span>{savedAddress.address}</span>
                        {typeof savedAddress.latitude === "number" && (
                          <small>
                            {savedAddress.latitude.toFixed(5)}, {savedAddress.longitude.toFixed(5)}
                          </small>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {!address && addresses.length === 0 && (
                <div className="address-missing">
                  <p>No delivery address saved yet.</p>
                </div>
              )}

              {showAddressOptions && (
                <button
                  className="add-address-btn"
                  type="button"
                  onClick={() => setShowAddressForm(!showAddressForm)}
                >
                  {showAddressForm ? "Close" : "+ Add New Address"}
                </button>
              )}

              {showAddressOptions && showAddressForm && (
                <form className="address-form" onSubmit={handleAddAddress}>
                  <input
                    type="text"
                    placeholder="Label (Home, Work...)"
                    value={newAddressLabel}
                    onChange={(event) => setNewAddressLabel(event.target.value)}
                  />
                  <textarea
                    placeholder="Enter complete delivery address"
                    value={newAddressText}
                    onChange={(event) => setNewAddressText(event.target.value)}
                    required
                    rows={3}
                  />
                  <button type="submit">Save Address</button>
                </form>
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
                {PAYMENT_METHODS.map((method) => (
                  <label
                    className={`payment-option ${paymentMethod === method.id ? "selected" : ""}`}
                    key={method.id}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.id}
                      checked={paymentMethod === method.id}
                      onChange={(event) => {
                        setPaymentMethod(event.target.value);
                        setError("");
                      }}
                    />
                    <span className="payment-radio" />
                    <span className="payment-copy">
                      <strong>{method.label}</strong>
                      <small>{method.note}</small>
                    </span>
                  </label>
                ))}
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
            <div className="summary-row"><span>Delivery</span><strong>₹{summary.delivery.toFixed(2)}</strong></div>
            <div className="summary-total"><span>Total</span><strong>₹{summary.total.toFixed(2)}</strong></div>
            <button className="place-order-btn" type="button" onClick={handlePlaceOrder}>
              Continue / Place Order
            </button>
          </aside>
        </div>
      </main>
    </>
  );
};

export default Checkout;

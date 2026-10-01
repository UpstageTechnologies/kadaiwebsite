                                                                                                                                                                    import { useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiCheck, FiMapPin } from "react-icons/fi";
import { useLocation as useRouteLocation, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import AddressChangeModal from "../../components/AddressChangeModal";
import { useAuth } from "../../components/AuthContext";
import { useCart } from "../../components/CardContext";
import { useLocation } from "../../components/LocationContext";
import { firebaseUpdateCustomer } from "../../services/firebase";
import { calculateSubtotal } from "../cart/cart.service";
import { getPaymentMethodLabel, placeOrder } from "../orders/orders.service";
import {
  getSavedAddresses,
  getSelectedAddress,
} from "./address.service";

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
  const { location } = useLocation();
  const { user, customer, loading: isAuthLoading } = useAuth();
  const [error, setError] = useState("");
  const [successOrder, setSuccessOrder] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [hiddenAddressIds, setHiddenAddressIds] = useState([]);
  const [isAddressOptionsOpen, setIsAddressOptionsOpen] = useState(false);

  const isAuthenticated = Boolean(user);
  const addresses = getSavedAddresses(location, customer?.address)
    .filter((address) => !hiddenAddressIds.includes(address.id));
  const selectedAddress = addresses.find((address) => address.id === selectedAddressId)
    || getSelectedAddress(addresses);
  const showAddressOptions = isAddressOptionsOpen || (!isAuthLoading && addresses.length === 0);
  const isAddressLoading = isAuthLoading;

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

  const handleSelectAddress = (nextAddress) => {
    if (!nextAddress) {
      return;
    }

    setSelectedAddressId(nextAddress.id);
    setIsAddressOptionsOpen(false);
    setError("");
  };

  const handleDeleteAddress = (selectedAddressId) => {
    if (!selectedAddressId) return;

    if (selectedAddressId === "saved-profile-address") {
      firebaseUpdateCustomer(user.uid, { address: {} })
        .then(() => setSelectedAddressId(""))
        .catch((addressError) => {
          setError(addressError?.message || "Unable to remove your saved address.");
        });
      return;
    }

    setHiddenAddressIds((current) => [...new Set([...current, selectedAddressId])]);
    setSelectedAddressId("");
    setIsAddressOptionsOpen(false);
    setError("");
  };

  const handleEditAddress = () => {
    setIsAddressOptionsOpen(true);
    setError("");
  };

  const handleAddressSaved = (nextAddress) => {
    setHiddenAddressIds([]);
    setSelectedAddressId(nextAddress.id || "saved-profile-address");
    setIsAddressOptionsOpen(false);
    setError("");
  };

  const handlePlaceOrder = () => {
    if (!selectedAddress) {
      setError("Please select a delivery address.");
      return;
    }

    if (!summary.total || summary.total <= 0) {
      setError("Invalid or missing checkout amount.");
      return;
    }

    const order = placeOrder({
      cartItems,
      address: selectedAddress,
      paymentMethod: "cod",
      summary,
      paymentStatus: "Pending",
      customerName: customer?.fullName || customer?.name || user?.displayName || "Customer",
    });

    if (!order) {
      setError("Order creation failed. Please try again.");
      return;
    }

    clearCart();
    setSuccessOrder(order);
    setError("");
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

              {!isAddressLoading && (
                <>
              {selectedAddress && !showAddressOptions && (
                <div className="selected-address-preview">
                  <div className="address-copy">
                    <strong>{selectedAddress.label || "Selected address"}</strong>
                    <span>{selectedAddress.address}</span>
                  </div>
                  <div className="address-preview-actions">
                    <button
                      className="change-address-btn"
                      type="button"
                      onClick={() => setIsAddressOptionsOpen(true)}
                    >
                      Change address
                    </button>
                    <button
                      className="edit-address-btn"
                      type="button"
                      onClick={handleEditAddress}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}

              {(!selectedAddress || showAddressOptions) && addresses.length > 0 && (
                <div className="address-list">
                  {addresses.map((savedAddress) => (
                    <label
                      className={`saved-address ${selectedAddress?.id === savedAddress.id ? "selected" : ""}`}
                      key={savedAddress.id}
                    >
                      <input
                        type="radio"
                        name="deliveryAddress"
                        checked={selectedAddress?.id === savedAddress.id}
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
                      <span className="address-actions">
                        <button
                          className="inline-edit-address-btn"
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleEditAddress();
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="inline-delete-address-btn"
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleDeleteAddress(savedAddress.id);
                          }}
                        >
                          Delete
                        </button>
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {!selectedAddress && addresses.length === 0 && (
                <div className="address-missing">
                  <p>No delivery address saved yet.</p>
                </div>
              )}

              {showAddressOptions && (
                <AddressChangeModal
                  open={showAddressOptions}
                  onClose={() => setIsAddressOptionsOpen(false)}
                  onSaved={handleAddressSaved}
                />
              )}

              {!selectedAddress && (
                <button
                  className="add-address-btn"
                  type="button"
                  onClick={() => {
                    setIsAddressOptionsOpen(true);
                    setError("");
                  }}
                >
                  + Add New Address
                </button>
              )}
                </>
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
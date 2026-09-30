                                                                                                                                                                                     import { useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiArrowRight, FiCheck, FiClock, FiShoppingCart } from "react-icons/fi";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";

import Navbar from "../../components/Navbar";
import { db } from "../../services/firebase";
import { getCurrentCustomerId, getSavedOrders } from "../orders/orders.service";

import "./track-order.css";

const STATUS_ORDER = [
  "Order Placed",
  "Accepted",
  "Packed",
  "Out For Delivery",
  "Delivered",
];

const TIMELINE_STEPS = [
  { key: "Order Placed", description: "Shop received your order request" },
  { key: "Accepted", description: "Shop owner accepted your order" },
  { key: "Packed", description: "Items packed and ready for pickup" },
  { key: "Out For Delivery", description: "Delivery partner picked from shop" },
  { key: "Delivered", description: "Package delivered successfully" },
];

const STATUS_COLORS = {
  Delivered: "#16a34a",
  "Out For Delivery": "#2563eb",
  Packed: "#9333ea",
  Accepted: "#007185",
  Rejected: "#ef4444",
  Pending: "#f59e0b",
  "Pending Verification": "#f59e0b",
};

const getStatusColor = (status) => STATUS_COLORS[status] || "#ff9900";

const formatDateTime = (value) => {
  if (!value) return "";

  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return `${date.toLocaleDateString()} - ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const getShopTimelineSteps = (shop, mainOrder) => {
  const currentStatus = shop.status || mainOrder.status || "Order Placed";
  const lastStatus = shop.lastStatus || mainOrder.lastStatus || "";
  const pendingMessage = shop.pendingMessage || mainOrder.pendingMessage || "";
  const hasPendingMessage =
    (currentStatus === "Pending" || mainOrder.status === "Pending") &&
    Boolean(String(pendingMessage).trim());

  const effectiveStatus = currentStatus === "Pending" ? lastStatus : currentStatus;
  const activeIndex = Math.max(0, STATUS_ORDER.indexOf(effectiveStatus));
  const lastActiveIndex = STATUS_ORDER.indexOf(lastStatus);
  const completedIndex = lastActiveIndex >= 0 ? lastActiveIndex : activeIndex;
  const delayTargetIndex = hasPendingMessage
    ? Math.min(completedIndex + 1, STATUS_ORDER.length - 1)
    : -1;

  return TIMELINE_STEPS.map((step, index) => ({
    ...step,
    done: hasPendingMessage ? index <= completedIndex : index <= activeIndex,
    current: !hasPendingMessage && effectiveStatus === step.key,
    delayed: hasPendingMessage && index === delayTargetIndex,
  }));
};

const getItems = (shop, order) => {
  const items = Array.isArray(shop.items) ? shop.items : order.items;
  return Array.isArray(items) ? items : [];
};

const TrackOrder = () => {
  const navigate = useNavigate();
  const { orderId = "" } = useParams();
  const customerId = getCurrentCustomerId();
  const [orderData, setOrderData] = useState(null);
  const [customerName, setCustomerName] = useState("Customer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!customerId || !db) return undefined;

    getDoc(doc(db, "customers", customerId)).then((snapshot) => {
      if (!snapshot.exists()) return;

      const profile = snapshot.data() || {};
      setCustomerName(profile.name || profile.fullName || profile.displayName || "Customer");
    }).catch((profileError) => {
      console.error("[TRACKING] Customer profile read failed:", profileError);
    });

    return undefined;
  }, [customerId]);

  useEffect(() => {
    if (!customerId || !orderId) return undefined;

    if (!db) return undefined;

    const showLocalOrder = () => {
      const localOrder = getSavedOrders().find(
        (order) => String(order.id || order.orderId) === String(orderId)
      );

      if (localOrder) {
        setOrderData(localOrder);
        setError("");
        setLoading(false);
        return true;
      }

      return false;
    };

    const handleSnapshot = (snapshot, requireCustomerMatch = false) => {
      const data = snapshot.data() || {};
      const belongsToCustomer = !requireCustomerMatch || !data.customerId || data.customerId === customerId;

      setOrderData(snapshot.exists() && belongsToCustomer ? { ...data, id: snapshot.id } : null);
      setError("");
      setLoading(false);
    };

    let topLevelUnsubscribe = () => {};
    const subscribeToTopLevelOrder = () => {
      topLevelUnsubscribe = onSnapshot(
        doc(db, "orders", orderId),
        (snapshot) => {
          if (snapshot.exists()) {
            handleSnapshot(snapshot, true);
            return;
          }

          if (!showLocalOrder()) {
            setOrderData(null);
            setError("Unable to load this order right now.");
            setLoading(false);
          }
        },
        (listenerError) => {
          console.error("[TRACKING] Order listener failed:", listenerError);
          if (!showLocalOrder()) {
            setOrderData(null);
            setError("Unable to load this order right now.");
            setLoading(false);
          }
        }
      );
    };

    const customerUnsubscribe = onSnapshot(
      doc(db, "customers", customerId, "orders", orderId),
      (snapshot) => {
        if (snapshot.exists()) {
          topLevelUnsubscribe();
          topLevelUnsubscribe = () => {};
          handleSnapshot(snapshot);
          return;
        }

        subscribeToTopLevelOrder();
      },
      (listenerError) => {
        console.error("[TRACKING] Customer order listener failed:", listenerError);
        subscribeToTopLevelOrder();
      }
    );

    return () => {
      customerUnsubscribe();
      topLevelUnsubscribe();
    };
  }, [customerId, orderId]);

  const shops = useMemo(() => {
    if (!orderData) return [];
    return Array.isArray(orderData.orderedShops) && orderData.orderedShops.length
      ? orderData.orderedShops
      : [orderData];
  }, [orderData]);

  const missingOrder = !orderId || !customerId;
  const firebaseUnavailable = !db && !missingOrder;

  if (missingOrder) {
    return (
      <>
        <Navbar />
        <main className="track-order-page">
          <section className="track-state-card">
            <FiAlertCircle />
            <h1>Order not available</h1>
            <p>Please sign in and open tracking from your orders.</p>
            <button type="button" onClick={() => navigate("/orders")}>View Orders</button>
          </section>
        </main>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="track-order-page">
          <section className="track-state-card">
            <div className="track-spinner" aria-hidden="true" />
            <h1>Fetching live order status...</h1>
          </section>
        </main>
      </>
    );
  }

  if (firebaseUnavailable || error || !orderData) {
    return (
      <>
        <Navbar />
        <main className="track-order-page">
          <section className="track-state-card">
            <FiAlertCircle />
            <h1>{error || (firebaseUnavailable ? "Unable to load this order right now." : "Order not found")}</h1>
            <p>We could not find a live order with that ID.</p>
            <button type="button" onClick={() => navigate("/orders")}>View Orders</button>
          </section>
        </main>
      </>
    );
  }

  const total = Number(orderData.total ?? orderData.totalAmount ?? 0);
  const overallStatus = orderData.status || "Order Placed";

  return (
    <>
      <Navbar />
      <main className="track-order-page">
        <header className="track-order-header">
          <span>LIVE ORDER TRACKING</span>
          <h1>Order Progress</h1>
          <p>Updates appear automatically as your order moves through each stage.</p>
        </header>

        <section className="track-summary-card">
          <div>
            <small>Order ID</small>
            <strong>{orderData.orderId || orderData.id || orderId}</strong>
          </div>
          <div>
            <small>Customer</small>
            <strong>{customerName}</strong>
          </div>
          <div>
            <small>Total amount</small>
            <strong>₹{total.toLocaleString("en-IN")}</strong>
          </div>
          <div className="track-summary-status">
            <small>Overall status</small>
            <strong style={{ color: getStatusColor(overallStatus) }}>{overallStatus}</strong>
          </div>
        </section>

        <h2 className="track-section-title">Order Progress</h2>

        <div className="track-shop-list">
          {shops.map((shop, shopIndex) => {
            const shopStatus = shop.status || overallStatus;
            const items = getItems(shop, orderData);
            const steps = getShopTimelineSteps(shop, orderData);
            const pendingMessage = shop.pendingMessage || orderData.pendingMessage;
            const pendingUntil = shop.pendingUntil || orderData.pendingUntil;

            return (
              <section className="track-shop-card" key={`${shop.shopName || "shop"}-${shopIndex}`}>
                <div className="track-shop-heading">
                  <div className="track-shop-name">
                    <FiShoppingCart />
                    <h3>{shop.shopName || "Smart POS Store"}</h3>
                  </div>
                  <span
                    className="track-status-badge"
                    style={{ color: getStatusColor(shopStatus) }}
                  >
                    {shopStatus}
                  </span>
                </div>

                <div className="track-items">
                  <strong>Items</strong>
                  <span>
                    {items.length
                      ? items.map((item, itemIndex) => (
                        <span key={`${item.itemName || item.name}-${itemIndex}`}>
                          {item.itemName || item.name || "Product"} (x{item.qty ?? item.quantity ?? 0}){itemIndex < items.length - 1 ? ", " : ""}
                        </span>
                      ))
                      : "Order items unavailable"}
                  </span>
                </div>

                {shopStatus === "Rejected" ? (
                  <div className="track-rejected-box">
                    <FiAlertCircle />
                    <span>This shop has rejected or cancelled your order.</span>
                  </div>
                ) : (
                  <div className="track-timeline">
                    {steps.map((step, index) => (
                      <div className="track-step-group" key={step.key}>
                        <div className="track-step">
                          <div className="track-step-rail">
                            <span
                              className={`track-step-dot${step.done ? " done" : ""}${step.current ? " current" : ""}${step.delayed ? " delayed" : ""}`}
                            >
                              {step.done && !step.current && !step.delayed ? <FiCheck /> : step.current ? <span /> : step.delayed ? <FiClock /> : null}
                            </span>
                            {index < steps.length - 1 && <span className={`track-step-line${step.done && !step.delayed ? " done" : ""}`} />}
                          </div>
                          <div className="track-step-copy">
                            <strong className={step.delayed ? "delayed" : ""}>{step.key}</strong>
                            <span>{step.description}</span>
                          </div>
                        </div>

                        {step.delayed && (
                          <div className="track-delay-card">
                            <strong><FiClock /> Delivery Update - From Store</strong>
                            <p>{pendingMessage}</p>
                            {pendingUntil && <small>Expected resume: {formatDateTime(pendingUntil)}</small>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <button className="track-continue-button" type="button" onClick={() => navigate("/products")}>
          Continue Shopping <FiArrowRight />
        </button>
      </main>
    </>
  );
};

export default TrackOrder;
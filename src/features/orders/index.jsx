import { useEffect, useState } from "react";
import { FiArrowRight, FiPackage } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import Navbar from "../../components/Navbar";
import { useAuth } from "../../components/AuthContext";
import { subscribeCustomerOrders } from "./orders.service";

import "./orders.css";

const formatLocaleIndianNumber = (value) =>
  Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const getOrderItemsPreview = (order) => {
  const items = Array.isArray(order?.items) ? order.items : [];

  if (!items.length) {
    return "Order items unavailable";
  }

  return items
    .map((item) => `${item?.name || item?.itemName || "Product"} x ${item?.quantity ?? item?.qty ?? 0}`)
    .join(", ");
};

const Orders = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [ordersState, setOrdersState] = useState({ customerId: "", orders: [] });
  const orders = ordersState.customerId === user?.uid ? ordersState.orders : [];

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    const customerId = user?.uid || "";
    if (!customerId) {
      setOrdersState({ customerId: "", orders: [] });
      return undefined;
    }

    const unsubscribe = subscribeCustomerOrders({
      customerId,
      onOrders: (firestoreOrders) =>
        setOrdersState({ customerId, orders: firestoreOrders }),
    });

    return () => unsubscribe();
  }, [loading, user?.uid]);

  return (
    <>
      <Navbar />
      <main className="orders-page">
        <header className="orders-header">
          <span>YOUR ACCOUNT</span>
          <h1>My Orders</h1>
          <p>Track your recent Kadai orders in one place.</p>
        </header>

        {orders.length === 0 ? (
          <section className="orders-empty">
            <FiPackage />
            <h2>No orders yet</h2>
            <p>Your placed orders will appear here.</p>
            <button type="button" onClick={() => navigate("/products")}>
              Start Shopping
            </button>
          </section>
        ) : (
          <div className="orders-list">
            {orders.map((order, index) => {
              const total = Number(order?.total ?? order?.totalAmount ?? 0);
              const address =
                typeof order?.address === "string"
                  ? order.address
                  : order?.address?.address || "Address unavailable";
              const orderId = order?.orderId || order?.id || "Kadai order";
              const createdAt = order?.createdAt ? new Date(order.createdAt) : null;

              return (
                <article className="order-card" key={order?.id || `order-${index}`}>
                  <div className="order-card-heading">
                    <div>
                      <strong>{orderId}</strong>
                      <span>
                        {createdAt && !Number.isNaN(createdAt.getTime())
                          ? createdAt.toLocaleDateString("en-IN")
                          : "Date unavailable"}
                      </span>
                    </div>
                    <b>{order?.status || "Placed"}</b>
                  </div>

                  <p>{getOrderItemsPreview(order)}</p>

                  <div className="order-card-footer">
                    <span>Cash on Delivery</span>
                    <strong>₹{formatLocaleIndianNumber(total)}</strong>
                  </div>

                  <small>{address}</small>

                  <button
                    className="track-order-button"
                    type="button"
                    onClick={() =>
                      navigate(`/track-order/${encodeURIComponent(order.id)}`, {
                        state: {
                          orderId: order.orderId || order.id,
                          appMode: order.appMode,
                        },
                      })
                    }
                  >
                    Track My Order
                    <FiArrowRight aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
};

export default Orders;

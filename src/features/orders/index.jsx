import { useEffect, useState } from "react";
import { FiArrowRight, FiPackage } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import Navbar from "../../components/Navbar";
import { useAuth } from "../../components/AuthContext";
import { subscribeCustomerOrders } from "./orders.service";

import "./orders.css";

const formatLocaleIndianNumber = (value) =>
  Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const Orders = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [ordersState, setOrdersState] = useState({
    customerId: "",
    orders: [],
    error: "",
  });
  const orders = ordersState.customerId === user?.uid ? ordersState.orders : [];
  const ordersError = ordersState.customerId === user?.uid ? ordersState.error : "";

  useEffect(() => {
    if (loading) {
      return undefined;
    }

    const customerId = user?.uid || "";
    if (!customerId) {
      return undefined;
    }

    const unsubscribe = subscribeCustomerOrders({
      customerId,
      onOrders: (firestoreOrders) =>
        setOrdersState({ customerId, orders: firestoreOrders, error: "" }),
      onError: (error) =>
        setOrdersState({
          customerId,
          orders: [],
          error: error?.message || "Unable to load your orders. Please try again.",
        }),
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

        {ordersError ? (
          <section className="orders-empty" role="alert">
            <FiPackage />
            <h2>Unable to load orders</h2>
            <p>{ordersError}</p>
          </section>
        ) : orders.length === 0 ? (
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
                  : order?.address?.fullAddress || order?.address?.address || "Address unavailable";
              const orderId = order?.orderId || order?.id || "Kadai order";
              const createdAt = order?.createdAt ? new Date(order.createdAt) : null;
              const shops = Array.isArray(order?.orderedShops) && order.orderedShops.length
                ? order.orderedShops
                : [{
                    shopName: "Store",
                    items: Array.isArray(order?.items) ? order.items : [],
                    subTotal: order?.subtotal,
                  }];

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

                  <div className="order-shop-list">
                    {shops.map((shop, shopIndex) => (
                      <section className="order-shop" key={`${shop.shopId || shop.shopName}-${shopIndex}`}>
                        <div className="order-shop-heading">
                          <strong>{shop.shopName || "Store"}</strong>
                          <span>Shop subtotal: ₹{formatLocaleIndianNumber(shop.subTotal ?? shop.subtotal)}</span>
                        </div>
                        {(Array.isArray(shop.items) ? shop.items : []).map((item, itemIndex) => (
                          <div className="order-item-line" key={`${item.itemNo || item.id || item.itemName}-${itemIndex}`}>
                            <span>
                              {item.name || item.itemName || "Product"} × {item.quantity ?? item.qty ?? 0}
                              {" · "}₹{formatLocaleIndianNumber(item.price)} each
                            </span>
                            <strong>
                              ₹{formatLocaleIndianNumber(item.itemTotal ?? Number(item.price || 0) * Number(item.quantity ?? item.qty ?? 0))}
                            </strong>
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>

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

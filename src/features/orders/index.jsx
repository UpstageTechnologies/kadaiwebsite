import { FiPackage } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import Navbar from "../../components/Navbar";
import { getSavedOrders } from "./orders.service";

import "./orders.css";

const Orders = () => {
  const navigate = useNavigate();
  const orders = getSavedOrders();

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
            <button type="button" onClick={() => navigate("/products")}>Start Shopping</button>
          </section>
        ) : (
          <div className="orders-list">
            {orders.map((order, index) => {
              const items = Array.isArray(order?.items) ? order.items : [];
              const total = Number(order?.total) || 0;
              const address = typeof order?.address === "string"
                ? order.address
                : order?.address?.address || "Address unavailable";

              return (
              <article className="order-card" key={order?.id || `order-${index}`}>
                <div className="order-card-heading">
                  <div><strong>{order?.id || "Kadai order"}</strong><span>{order?.createdAt ? new Date(order.createdAt).toLocaleDateString() : "Date unavailable"}</span></div>
                  <b>{order?.status || "Placed"}</b>
                </div>
                <p>{items.map((item) => `${item?.name || "Product"} x ${item?.quantity || 0}`).join(", ") || "Order items unavailable"}</p>
                <div className="order-card-footer"><span>{order?.paymentMethod === "cod" ? "Cash on Delivery" : order?.paymentMethod === "google-pay" ? "Google Pay" : "Razorpay"}</span><strong>₹{total.toFixed(2)}</strong></div>
                <small>{address}</small>
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
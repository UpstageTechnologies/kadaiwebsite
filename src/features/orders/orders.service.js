                                                                                                                                                                               import { collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { auth, db } from "../../services/firebase";

export const getCurrentCustomerId = () => {
  return auth?.currentUser?.uid || "";
};

export const persistOrder = async (order) => {
  const customerId = getCurrentCustomerId();

  if (!db || !customerId || !order?.id) {
    return false;
  }

  const orderData = {
    ...order,
    customerId,
  };

  await Promise.all([
    setDoc(doc(db, "orders", order.id), orderData, { merge: true }),
    setDoc(doc(db, "customers", customerId, "orders", order.id), orderData, { merge: true }),
  ]);

  return true;
};

export const subscribeCustomerOrders = ({ customerId, onOrders, onError }) => {
  if (!db || !customerId) {
    onOrders?.([]);
    return () => {};
  }

  const ordersQuery = query(
    collection(db, "orders"),
    where("customerId", "==", customerId)
  );

  return onSnapshot(
    ordersQuery,
    (snapshot) => {
      const orders = snapshot.docs.map((orderSnapshot) => {
        const data = orderSnapshot.data() || {};
        return {
          ...data,
          id: orderSnapshot.id,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
        };
      });

      onOrders?.(orders);
    },
    (error) => {
      console.error("[FIRESTORE] Customer orders listener failed:", error);
      onError?.(error);
    }
  );
};

export const getPaymentMethodLabel = (paymentMethod) => {
  if (paymentMethod === "cod") return "Cash on Delivery";
  if (paymentMethod === "google-pay") return "Google Pay";
  if (paymentMethod === "razorpay") return "Razorpay";
  return paymentMethod || "Payment";
};

export const buildOrderFromCheckout = ({
  cartItems,
  address,
  summary,
  customerName,
}) => {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return null;
  }

  if (!address) {
    return null;
  }

  const orderId = `KADAI-${Date.now()}`;
  const orderCustomerName = customerName || auth?.currentUser?.displayName || "Customer";

  const shops = new Map();
  cartItems.forEach((item) => {
    const shopKey = item.shopId || item.sellerId || item.shopName || "store";
    const shop = shops.get(shopKey) || {
      shopName: item.shopName || "Store",
      status: "Order Placed",
      items: [],
    };

    shop.items.push({
      itemName: item.itemName || item.name || "Product",
      qty: item.qty ?? item.quantity ?? 0,
    });
    shops.set(shopKey, shop);
  });

  const order = {
    id: orderId,
    orderId,
    customerName: orderCustomerName,
    items: cartItems.map((item) => ({ ...item })),
    orderedShops: [...shops.values()],
    address,
    paymentMethod: "cod",
    paymentStatus: "Pending",
    paymentGatewayReference: "",
    subtotal: Number(summary?.subtotal || 0),
    delivery: Number(summary?.delivery || 0),
    total: Number(summary?.total || 0),
    totalAmount: Number(summary?.total || 0),
    status: "Order Placed",
    createdAt: new Date().toISOString(),
  };

  return order;
};

export const placeOrder = (payload) => {
  const order = buildOrderFromCheckout(payload);

  if (!order) {
    return null;
  }

  persistOrder(order).catch((error) => {
    console.error("[FIRESTORE] Order persistence failed:", error);
  });

  return order;
};

export const placeOrderFromCheckout = placeOrder;
                                                                                                                                                                               import { collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { auth, db } from "../../services/firebase";

const getOrderStorageKey = () => {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

  if (!isLoggedIn) {
    return "kadai.orders.guest";
  }

  try {
    const user = JSON.parse(localStorage.getItem("registeredUser") || "null");
    const email = user?.email?.trim().toLowerCase();
    return email ? `kadai.orders.${email}` : "kadai.orders.guest";
  } catch {
    return "kadai.orders.guest";
  }
};

export const getCurrentCustomerId = () => {
  if (auth?.currentUser?.uid) {
    return auth.currentUser.uid;
  }

  try {
    return JSON.parse(localStorage.getItem("registeredUser") || "null")?.uid || "";
  } catch {
    return "";
  }
};

export const getSavedOrders = () => {
  try {
    const savedOrders = JSON.parse(
      localStorage.getItem(getOrderStorageKey()) || "[]"
    );
    return Array.isArray(savedOrders) ? savedOrders : [];
  } catch {
    return [];
  }
};

export const saveOrder = (order) => {
  const orders = getSavedOrders();
  localStorage.setItem(
    getOrderStorageKey(),
    JSON.stringify([order, ...orders])
  );
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
}) => {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return null;
  }

  if (!address) {
    return null;
  }

  const savedOrders = getSavedOrders();
  const orderId = `KADAI-${String(savedOrders.length + 1).padStart(4, "0")}`;
  let customerName = "Customer";

  try {
    const savedUser = JSON.parse(localStorage.getItem("registeredUser") || "null");
    customerName = savedUser?.fullName || savedUser?.name || customerName;
  } catch {
    // Keep order creation working when legacy user data is malformed.
  }

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
    customerName,
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

  const existingOrders = getSavedOrders();
  const alreadyExists = existingOrders.some((savedOrder) => savedOrder.id === order.id);

  if (!alreadyExists) {
    saveOrder(order);
    persistOrder(order).catch((error) => {
      console.error("[FIRESTORE] Order persistence failed:", error);
    });
  }

  return order;
};

export const placeOrderFromCheckout = placeOrder;
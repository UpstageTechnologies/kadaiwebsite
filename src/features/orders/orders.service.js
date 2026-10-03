import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "../../services/firebase";

export const getCurrentCustomerId = () => auth?.currentUser?.uid || "";

const toEpochMillis = (value) => {
  if (!value) {
    return 0;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value?.toDate === "function") {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
  }

  if (typeof value?.seconds === "number") {
    const seconds = Number(value.seconds) * 1000;
    const nanoseconds = Number(value.nanoseconds || 0) / 1_000_000;
    return seconds + nanoseconds;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

export const compareOrderDates = (a, b) => {
  const left = toEpochMillis(a);
  const right = toEpochMillis(b);
  return right - left;
};

export const persistOrder = async (order) => {
  const customerId = getCurrentCustomerId();

  if (!db || !customerId || !order?.id) {
    return false;
  }

  const orderData = {
    ...order,
    customerId,
    paymentMethod: "cod",
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

  const customerOrdersRef = collection(db, "customers", customerId, "orders");

  return onSnapshot(
    customerOrdersRef,
    (snapshot) => {
      const orders = snapshot.docs
        .map((orderSnapshot) => {
          const data = orderSnapshot.data() || {};
          const createdAtRaw = data.createdAt;

          return {
            ...data,
            id: orderSnapshot.id,
            orderId: data.orderId || orderSnapshot.id,
            paymentMethod: "cod",
            createdAt: createdAtRaw?.toDate
              ? createdAtRaw.toDate().toISOString()
              : createdAtRaw,
          };
        })
        .sort((left, right) => compareOrderDates(left.createdAt, right.createdAt));

      onOrders?.(orders);
    },
    (error) => {
      console.error("[FIRESTORE] Customer orders listener failed:", error);
      onError?.(error);
    }
  );
};

export const getPaymentMethodLabel = (paymentMethod) => {
  if (!paymentMethod || paymentMethod === "cod") {
    return "Cash on Delivery";
  }

  return "Cash on Delivery";
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

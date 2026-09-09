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

export const getPaymentMethodLabel = (paymentMethod) => {
  if (paymentMethod === "cod") return "Cash on Delivery";
  if (paymentMethod === "google-pay") return "Google Pay";
  if (paymentMethod === "razorpay") return "Razorpay";
  return paymentMethod || "Payment";
};

export const buildOrderFromCheckout = ({
  cartItems,
  address,
  paymentMethod,
  summary,
  paymentStatus,
  paymentGatewayReference,
}) => {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return null;
  }

  if (!address) {
    return null;
  }

  const savedOrders = getSavedOrders();
  const orderId = `KADAI-${String(savedOrders.length + 1).padStart(4, "0")}`;
  const order = {
    id: orderId,
    items: cartItems.map((item) => ({ ...item })),
    address,
    paymentMethod,
    paymentStatus: paymentStatus || (paymentMethod === "cod" ? "Pending" : "Paid"),
    paymentGatewayReference: paymentGatewayReference || "",
    subtotal: Number(summary?.subtotal || 0),
    delivery: Number(summary?.delivery || 0),
    total: Number(summary?.total || 0),
    status: "Placed",
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
  }

  return order;
};

export const placeOrderFromCheckout = placeOrder;

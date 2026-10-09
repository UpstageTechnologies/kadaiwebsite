import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
} from "firebase/firestore";
import { auth, db } from "../../services/firebase";

export const getCurrentCustomerId = () => auth?.currentUser?.uid || "";

const normalizeNumber = (value, fallback = 0) => {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const ORDER_STATUS_FLOW = [
  "Order Placed",
  "Accepted",
  "Packed",
  "Out For Delivery",
  "Delivered",
];
const ORDER_STATUSES = [...ORDER_STATUS_FLOW, "Pending", "Rejected"];

const normalizeOrderItem = (item = {}) => {
  const quantity = Number(item.qty ?? item.quantity ?? 0);
  const price = Number(item.price ?? 0);
  const itemName = item.itemName || item.name || item.title || "Product";
  const itemNo = item.itemNo || item.itemNumber || item.code || item.sku || "";
  const image = item.img || item.image || item.productImage || "";

  return {
    ...item,
    itemName,
    itemNo,
    qty: quantity,
    quantity,
    price,
    img: image,
    itemTotal: Number((price * quantity).toFixed(2)),
  };
};

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

const createStableOrderFingerprint = ({ customerId, cartItems, address, total }) => {
  const items = Array.isArray(cartItems)
    ? cartItems
        .map((item) => ({
          id: item?.id ?? item?.itemId ?? "",
          shopId: item?.shopId ?? item?.sellerId ?? "",
          itemName: item?.name ?? item?.itemName ?? "",
          quantity: Number(item?.qty ?? item?.quantity ?? 0),
          price: Number(item?.price ?? 0),
        }))
        .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    : [];

  const addressText = typeof address === "string"
    ? address
    : [address?.fullAddress, address?.address, address?.street, address?.locality, address?.city, address?.state, address?.pincode]
        .filter(Boolean)
        .join("|");

  const payload = JSON.stringify({
    customerId: String(customerId || ""),
    items,
    addressText: String(addressText || ""),
    total: Number(total || 0),
    paymentMethod: "cod",
  });

  let hash = 0;
  for (let index = 0; index < payload.length; index += 1) {
    hash = ((hash << 5) - hash + payload.charCodeAt(index)) | 0;
  }

  return `order-${Math.abs(hash).toString(36)}`;
};

export const compareOrderDates = (a, b) => {
  const left = toEpochMillis(a);
  const right = toEpochMillis(b);
  return right - left;
};

const buildSellerOrderPayload = (orderData, shop) => {
  if (!shop) {
    return null;
  }

  const shopItems = Array.isArray(shop.items) ? shop.items.map(normalizeOrderItem) : [];
  const subtotal = shopItems.reduce(
    (total, item) => total + normalizeNumber(item.price) * normalizeNumber(item.qty),
    0
  );

  return {
    ...orderData,
    orderId: orderData.orderId || orderData.id,
    id: orderData.id,
    customerId: orderData.customerId || orderData.customerUid || "",
    customerUid: orderData.customerUid || orderData.customerId || "",
    shopId: shop.shopId || shop.sellerId || "",
    shopName: shop.shopName || "Store",
    status: shop.status || orderData.status || "Order Placed",
    paymentMethod: "cod",
    deliveryAddress: orderData.deliveryAddress || orderData.address || null,
    items: shopItems,
    orderedShops: [shop],
    subtotal,
    total: subtotal,
    totalAmount: subtotal,
    subTotal: subtotal,
    createdAt: orderData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export const persistOrder = async (order) => {
  const customerId = getCurrentCustomerId();

  if (!db) {
    throw new Error("Firebase Firestore is temporarily unavailable. Please try again.");
  }

  if (!customerId || customerId !== order?.customerId) {
    throw new Error("Your Firebase session is missing or changed. Please log in again.");
  }

  if (!order?.id) {
    throw new Error("The order is missing an ID and cannot be saved.");
  }

  const normalizedOrderItems = Array.isArray(order.items)
    ? order.items.map(normalizeOrderItem)
    : [];

  const orderedShops = Array.isArray(order.orderedShops)
    ? order.orderedShops.map((shop) => ({
        ...shop,
        shopId: shop.shopId || shop.sellerId || "",
        shopName: shop.shopName || "Store",
        status: shop.status || "Order Placed",
        items: Array.isArray(shop.items) ? shop.items.map(normalizeOrderItem) : [],
        subTotal: Number(
          (Array.isArray(shop.items) ? shop.items : []).reduce(
            (total, item) => total + normalizeNumber(item.price) * normalizeNumber(item.qty ?? item.quantity),
            0
          )
        ),
      }))
    : [];

  const safeAddress = order.deliveryAddress || order.address || null;
  const orderData = {
    ...order,
    customerId,
    customerUid: customerId,
    deliveryAddress: safeAddress,
    address: safeAddress,
    items: normalizedOrderItems,
    orderedShops,
    paymentMethod: "cod",
    subtotal: Number(order.subtotal ?? order.total ?? 0),
    delivery: Number(order.delivery ?? 0),
    total: Number(order.total ?? order.totalAmount ?? 0),
    totalAmount: Number(order.totalAmount ?? order.total ?? 0),
    createdAt: order.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const orderRef = doc(db, "orders", order.id);
  const customerOrderRef = doc(db, "customers", customerId, "orders", order.id);

  await runTransaction(db, async (transaction) => {
    const existingOrder = await transaction.get(orderRef);
    if (existingOrder.exists()) {
      return;
    }

    transaction.set(orderRef, orderData);
    transaction.set(customerOrderRef, orderData);

    orderedShops.forEach((shop) => {
      if (!shop.shopId) {
        throw new Error("A product is missing its seller ID. The order was not saved.");
      }

      const shopPayload = buildSellerOrderPayload(orderData, shop);
      transaction.set(doc(db, "users", shop.shopId, "orders", order.id), shopPayload);
    });
  });
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

  if (!db) {
    throw new Error("Firebase Firestore is temporarily unavailable. Please try again.");
  }

  const customerId = getCurrentCustomerId();
  if (!customerId) {
    throw new Error("Your Firebase session is missing. Please log in again.");
  }

  const orderId = createStableOrderFingerprint({
    customerId,
    cartItems,
    address,
    total: Number(summary?.total ?? cartItems.reduce(
      (total, item) => total + normalizeNumber(item.price) * normalizeNumber(item.qty ?? item.quantity),
      0
    )),
  });
  const orderCustomerName = customerName || auth?.currentUser?.displayName || "Customer";

  const shopMap = new Map();
  cartItems.forEach((item) => {
    const itemData = normalizeOrderItem(item);
    const shopId = item.shopId || item.sellerId || "";
    if (!shopId) {
      throw new Error(`Product "${itemData.itemName}" is missing its seller ID.`);
    }

    const shopKey = shopId || item.shopName || item.storeName || "store";
    const shop = shopMap.get(shopKey) || {
      shopId,
      shopName: item.shopName || item.storeName || "Store",
      status: "Order Placed",
      items: [],
    };

    shop.items.push(itemData);
    shopMap.set(shopKey, shop);
  });

  const orderedShops = [...shopMap.values()].map((shop) => {
    const items = Array.isArray(shop.items) ? shop.items.map(normalizeOrderItem) : [];
    const subTotal = items.reduce(
      (total, item) => total + normalizeNumber(item.price) * normalizeNumber(item.qty),
      0
    );

    return {
      ...shop,
      shopId: shop.shopId || "",
      shopName: shop.shopName || "Store",
      status: "Order Placed",
      subTotal,
      items,
    };
  });

  const subtotal = Number(summary?.subtotal ?? cartItems.reduce(
    (total, item) => total + normalizeNumber(item.price) * normalizeNumber(item.qty ?? item.quantity),
    0
  ));
  const delivery = Number(summary?.delivery ?? 0);
  const total = Number(summary?.total ?? subtotal + delivery);
  const marketModes = [...new Set(
    cartItems.map((item) => String(item.marketType || "").toLowerCase())
      .filter((mode) => mode === "local" || mode === "global")
  )];

  const deliveryAddress = address && typeof address === "object" && !Array.isArray(address)
    ? { ...address }
    : { address: String(address || "") };
  const order = {
    id: orderId,
    orderId,
    customerId,
    customerUid: customerId,
    customerName: orderCustomerName,
    customerPhone: auth?.currentUser?.phoneNumber || "",
    items: cartItems.map((item) => normalizeOrderItem(item)),
    orderedShops,
    address: deliveryAddress,
    deliveryAddress,
    paymentMethod: "cod",
    paymentStatus: "Pending",
    paymentGatewayReference: "",
    subtotal,
    delivery,
    total,
    totalAmount: total,
    status: "Order Placed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    appMode: "web",
    marketModes,
  };

  return order;
};

export const updateOrderStatus = async ({
  orderId,
  customerId,
  shopId,
  status,
  pendingMessage = "",
  pendingUntil = null,
}) => {
  if (!db) {
    throw new Error("Firebase Firestore is temporarily unavailable.");
  }
  const normalizedStatus = String(status).trim();
  if (!orderId || !shopId || !ORDER_STATUSES.includes(normalizedStatus)) {
    throw new Error("A valid order ID, shop ID, and order status are required.");
  }

  const orderRef = doc(db, "orders", orderId);
  await runTransaction(db, async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) {
      throw new Error("Order not found.");
    }

    const existingOrder = orderSnapshot.data() || {};
    const effectiveCustomerId = existingOrder.customerId || existingOrder.customerUid || "";
    if (!effectiveCustomerId || (customerId && customerId !== effectiveCustomerId)) {
      throw new Error("The order does not belong to the specified customer.");
    }

    const currentShops = Array.isArray(existingOrder.orderedShops)
      ? existingOrder.orderedShops
      : [];
    const shopIndex = currentShops.findIndex(
      (shop) => String(shop.shopId || "") === String(shopId)
    );
    if (shopIndex < 0) {
      throw new Error("This shop is not part of the order.");
    }

    const previousShop = currentShops[shopIndex];
    const updatedShop = {
      ...previousShop,
      status: normalizedStatus,
      lastStatus: normalizedStatus === "Pending"
        ? previousShop.lastStatus || previousShop.status || "Order Placed"
        : normalizedStatus,
      pendingMessage: normalizedStatus === "Pending" ? String(pendingMessage || "").trim() : "",
      pendingUntil: normalizedStatus === "Pending" ? pendingUntil : null,
    };
    const orderedShops = currentShops.map((shop, index) =>
      index === shopIndex ? updatedShop : shop
    );
    const statuses = orderedShops.map((shop) => shop.status || "Order Placed");
    const aggregateStatus = statuses.every((shopStatus) => shopStatus === statuses[0])
      ? statuses[0]
      : statuses.includes("Pending")
        ? "Pending"
        : statuses.includes("Rejected")
          ? "Rejected"
          : statuses
            .filter((shopStatus) => ORDER_STATUS_FLOW.includes(shopStatus))
            .sort((first, second) =>
              ORDER_STATUS_FLOW.indexOf(first) - ORDER_STATUS_FLOW.indexOf(second)
            )[0] || existingOrder.status || "Order Placed";
    const timestamp = new Date().toISOString();
    const sharedUpdate = {
      status: aggregateStatus,
      updatedAt: timestamp,
      orderedShops,
    };

    transaction.set(orderRef, sharedUpdate, { merge: true });
    transaction.set(
      doc(db, "customers", effectiveCustomerId, "orders", orderId),
      sharedUpdate,
      { merge: true }
    );
    transaction.set(
      doc(db, "users", shopId, "orders", orderId),
      {
        status: updatedShop.status,
        lastStatus: updatedShop.lastStatus,
        pendingMessage: updatedShop.pendingMessage,
        pendingUntil: updatedShop.pendingUntil,
        orderedShops: [updatedShop],
        updatedAt: timestamp,
      },
      { merge: true }
    );
  });

  return true;
};

export const placeOrder = async (payload) => {
  const order = buildOrderFromCheckout(payload);

  if (!order) {
    return null;
  }

  await persistOrder(order);
  return order;
};

export const placeOrderFromCheckout = placeOrder;
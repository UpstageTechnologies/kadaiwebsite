import { collection, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "../../services/firebase";

export const getCurrentCustomerId = () => auth?.currentUser?.uid || "";

const normalizeNumber = (value, fallback = 0) => {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
};

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

  if (!db || !customerId || !order?.id) {
    return false;
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

  const orderData = {
    ...order,
    customerId,
    customerUid: customerId,
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

  const sellerOrderWrites = orderedShops
    .filter((shop) => shop.shopId)
    .map((shop) => {
      const shopPayload = buildSellerOrderPayload(orderData, shop);
      if (!shopPayload) {
        return null;
      }

      return setDoc(
        doc(db, "users", shop.shopId, "orders", order.id),
        shopPayload,
        { merge: true }
      );
    })
    .filter(Boolean);

  await Promise.all([
    setDoc(doc(db, "orders", order.id), orderData, { merge: true }),
    setDoc(doc(db, "customers", customerId, "orders", order.id), orderData, { merge: true }),
    ...sellerOrderWrites,
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

  const customerId = getCurrentCustomerId();
  const orderId = `KADAI-${Date.now()}`;
  const orderCustomerName = customerName || auth?.currentUser?.displayName || "Customer";

  const shopMap = new Map();
  cartItems.forEach((item) => {
    const itemData = normalizeOrderItem(item);
    const shopId = item.shopId || item.sellerId || "";
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

  const order = {
    id: orderId,
    orderId,
    customerId,
    customerUid: customerId,
    customerName: orderCustomerName,
    customerPhone: auth?.currentUser?.phoneNumber || "",
    items: cartItems.map((item) => normalizeOrderItem(item)),
    orderedShops,
    address,
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
  };

  return order;
};

export const updateOrderStatus = async ({
  orderId,
  customerId,
  shopId,
  status,
}) => {
  if (!db || !orderId || !status) {
    return false;
  }

  const normalizedStatus = String(status).trim();
  if (!normalizedStatus) {
    return false;
  }

  const orderRef = doc(db, "orders", orderId);
  const existingOrderDoc = await getDoc(orderRef);
  const existingOrder = existingOrderDoc.exists() ? existingOrderDoc.data() || {} : {};
  const effectiveCustomerId = customerId || existingOrder.customerId || existingOrder.customerUid || "";
  const orderedShops = Array.isArray(existingOrder.orderedShops)
    ? existingOrder.orderedShops.map((shop) => {
        if (!shopId || String(shop.shopId || "") === String(shopId)) {
          return { ...shop, status: normalizedStatus };
        }
        return shop;
      })
    : [];

  const timestamp = new Date().toISOString();
  const baseUpdate = {
    status: normalizedStatus,
    updatedAt: timestamp,
    orderedShops,
  };

  const tasks = [
    setDoc(orderRef, baseUpdate, { merge: true }),
  ];

  if (effectiveCustomerId) {
    tasks.push(
      setDoc(doc(db, "customers", effectiveCustomerId, "orders", orderId), baseUpdate, { merge: true })
    );
  }

  if (shopId) {
    tasks.push(
      setDoc(doc(db, "users", shopId, "orders", orderId), {
        ...baseUpdate,
        orderId,
        customerId: effectiveCustomerId,
        shopId,
        updatedAt: timestamp,
      }, { merge: true })
    );
  }

  await Promise.all(tasks);
  return true;
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

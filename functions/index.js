const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

exports.createCustomerOrder = onCall(async (request) => {
  const customerUid = request.auth?.uid;
  if (!customerUid) {
    throw new HttpsError("unauthenticated", "Please sign in before placing an order.");
  }

  const {
    orderId,
    address,
    customerName,
    appMode = "web",
    marketModes: requestedMarketModes = [],
  } = request.data || {};
  const marketModes = Array.isArray(requestedMarketModes) ? requestedMarketModes : [];
  if (
    typeof orderId !== "string"
    || !/^order-[a-z0-9]+$/i.test(orderId)
    || !address
    || !(typeof address === "string" || (typeof address === "object" && !Array.isArray(address)))
  ) {
    throw new HttpsError("invalid-argument", "A valid order ID and delivery address are required.");
  }

  const addressText = typeof address === "string"
    ? address.trim()
    : String(address.fullAddress || address.address || "").trim();
  if (!addressText) {
    throw new HttpsError("invalid-argument", "Please provide a full delivery address.");
  }

  let customerPhone = String(request.auth.token.phone_number || "");
  if (!customerPhone) {
    try {
      const authenticatedUser = await getAuth().getUser(customerUid);
      customerPhone = String(authenticatedUser.phoneNumber || "");
    } catch (error) {
      console.error("[ORDERS] Could not retrieve authenticated customer's phone:", error);
    }
  }
  if (!customerPhone) {
    throw new HttpsError("failed-precondition", "The phone number for your signed-in account is unavailable.");
  }

  const orderAddress = typeof address === "string"
    ? { address: addressText, fullAddress: addressText }
    : { ...address, address: addressText, fullAddress: addressText };
  orderAddress.phoneNumber = customerPhone;

  const customerRef = db.collection("customers").doc(customerUid);
  const orderRef = db.collection("orders").doc(orderId);
  const customerOrderRef = customerRef.collection("orders").doc(orderId);

  try {
    return await db.runTransaction(async (transaction) => {
      const [customerSnapshot, existingCustomerOrder, existingOrder] = await Promise.all([
        transaction.get(customerRef),
        transaction.get(customerOrderRef),
        transaction.get(orderRef),
      ]);

      const customerData = customerSnapshot.exists ? customerSnapshot.data() || {} : {};
      const cartItems = Array.isArray(customerData.cartItems) ? customerData.cartItems : [];
      if (!cartItems.length) {
        throw new HttpsError("failed-precondition", "Your cart is empty.");
      }

      const productReferences = cartItems.map((item) => {
        const shopId = String(item.shopId || item.sellerId || "");
        const itemId = String(item.id || item.itemId || "");
        const collectionName = String(item.marketType || "").toLowerCase() === "global"
          ? "global_inventory"
          : "inventory";
        if (!shopId || !itemId || shopId.includes("/") || itemId.includes("/")) {
          throw new HttpsError("failed-precondition", "A cart product has invalid store information.");
        }
        return db.collection("users").doc(shopId).collection(collectionName).doc(itemId);
      });
      const productSnapshots = await Promise.all(
        productReferences.map((reference) => transaction.get(reference))
      );

      const shopMap = new Map();
      const orderItems = cartItems.map((cartItem, index) => {
        const productSnapshot = productSnapshots[index];
        if (!productSnapshot.exists) {
          throw new HttpsError("failed-precondition", "A cart product is no longer available.");
        }

        const product = productSnapshot.data() || {};
        const quantity = Number(cartItem.qty ?? cartItem.quantity);
        const price = Number(product.salesPrice ?? product.price);
        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) {
          throw new HttpsError("failed-precondition", "A cart product has invalid quantity or pricing.");
        }

        const shopId = productSnapshot.ref.parent.parent.id;
        const itemName = String(product.itemName || product.name || product.title || "Product");
        const item = {
          id: productSnapshot.id,
          shopId,
          sellerId: shopId,
          itemName,
          name: itemName,
          itemNo: String(product.itemNo || product.itemNumber || product.code || product.sku || ""),
          qty: quantity,
          quantity,
          price,
          oldPrice: Number(product.oldPrice ?? product.mrp ?? price),
          img: String(product.img || product.image || product.productImage || ""),
          image: String(product.image || product.img || product.productImage || ""),
          description: String(product.description || product.itemDescription || ""),
          category: String(product.category || "General"),
          unit: String(product.unit || product.packaging || product.size || "1 item"),
          itemTotal: Number((price * quantity).toFixed(2)),
        };

        const shopName = String(product.shopName || product.storeName || "Store");
        const shop = shopMap.get(shopId) || {
          shopId,
          shopName,
          status: "Order Placed",
          items: [],
        };
        shop.items.push(item);
        shopMap.set(shopId, shop);
        return item;
      });

      const orderedShops = [...shopMap.values()].map((shop) => {
        const subTotal = shop.items.reduce((sum, item) => sum + item.itemTotal, 0);
        return { ...shop, subTotal };
      });
      const subtotal = orderItems.reduce((sum, item) => sum + item.itemTotal, 0);
      const delivery = 0;
      const total = subtotal + delivery;
      const createdAt = new Date().toISOString();
      const orderData = {
        id: orderId,
        orderId,
        customerId: customerUid,
        customerUid,
        customerName: String(customerName || customerData.fullName || customerData.name || request.auth.token.name || "Customer"),
        customerPhone,
        items: orderItems,
        orderedShops,
        address: orderAddress,
        deliveryAddress: orderAddress,
        paymentMethod: "cod",
        paymentStatus: "Pending",
        paymentGatewayReference: "",
        subtotal,
        delivery,
        total,
        totalAmount: total,
        status: "Order Placed",
        createdAt,
        updatedAt: createdAt,
        appMode: String(appMode || "web"),
        marketModes: [...new Set([
          ...marketModes.filter((mode) => mode === "local" || mode === "global"),
          ...cartItems.map((item) => String(item.marketType || "").toLowerCase())
            .filter((mode) => mode === "local" || mode === "global"),
        ])],
      };

      if (existingCustomerOrder.exists) {
        const existingData = existingCustomerOrder.data() || {};
        if (existingData.customerUid !== customerUid) {
          throw new HttpsError("already-exists", "This order ID belongs to another customer.");
        }

        const existingAddress = existingData.address || existingData.deliveryAddress || {};
        const existingAddressText = typeof existingAddress === "string"
          ? existingAddress.trim()
          : String(existingAddress.fullAddress || existingAddress.address || "").trim();
        const sameAddress = existingAddressText === addressText;
        const getItemSignature = (items) => (Array.isArray(items) ? items : [])
          .map((item) => ({
            id: String(item.id || ""),
            shopId: String(item.shopId || item.sellerId || ""),
            quantity: Number(item.quantity ?? item.qty ?? 0),
          }))
          .sort((first, second) => `${first.shopId}/${first.id}`.localeCompare(`${second.shopId}/${second.id}`));
        const sameItems = JSON.stringify(getItemSignature(existingData.items))
          === JSON.stringify(getItemSignature(orderItems));

        if (!sameAddress || !sameItems) {
          throw new HttpsError("already-exists", "This order ID was already used for a different order.");
        }

        return existingData;
      }
      if (existingOrder.exists) {
        throw new HttpsError("already-exists", "This order ID has already been used.");
      }

      transaction.set(orderRef, orderData);
      transaction.set(customerOrderRef, orderData);
      orderedShops.forEach((shop) => {
        const shopTotal = shop.subTotal;
        transaction.set(
          db.collection("users").doc(shop.shopId).collection("orders").doc(orderId),
          {
            ...orderData,
            shopId: shop.shopId,
            shopName: shop.shopName,
            items: shop.items,
            orderedShops: [shop],
            subtotal: shopTotal,
            total: shopTotal,
            totalAmount: shopTotal,
            subTotal: shopTotal,
          }
        );
      });

      return orderData;
    });
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error("[ORDERS] Trusted order transaction failed:", {
      code: error?.code || "unknown",
      message: error?.message || String(error),
      stack: error?.stack || "",
    });
    throw new HttpsError("internal", "Unable to place your order. Please try again.", {
      cause: error?.code || "unknown",
    });
  }
});

exports.createCustomerCustomToken = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { uid } = req.body || {};
  if (!uid || typeof uid !== "string") {
    return res.status(400).json({ error: "Missing customer uid." });
  }

  const authorization = req.get("Authorization") || "";
  const idToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (!idToken) {
    return res.status(401).json({ error: "A Firebase ID token is required." });
  }

  let authenticatedUser;
  try {
    authenticatedUser = await getAuth().verifyIdToken(idToken);
  } catch (error) {
    console.warn("Customer custom token request had an invalid Firebase ID token:", error);
    return res.status(401).json({ error: "The Firebase ID token is invalid or expired." });
  }

  if (authenticatedUser.uid !== uid) {
    return res.status(403).json({ error: "You can only request a token for your own account." });
  }

  const customerRef = db.collection("customers").doc(uid);
  const customerSnapshot = await customerRef.get();

  if (!customerSnapshot.exists) {
    return res.status(404).json({ error: "Customer not found." });
  }

  try {
    const customToken = await getAuth().createCustomToken(uid);
    return res.status(200).json({ customToken });
  } catch (error) {
    console.error("Custom token creation failed:", error);
    return res.status(500).json({ error: "Unable to establish the authenticated session." });
  }
});

const STATUS_TITLES = {
  "Order Placed": "Order Placed",
  Accepted: "Order Accepted",
  Packed: "Order Packed",
  Pending: "Order Delayed",
  "Out For Delivery": "Out For Delivery",
  Delivered: "Order Delivered",
  Rejected: "Order Rejected",
};

const STATUS_MESSAGES = {
  "Order Placed": "has been placed successfully",
  Accepted: "has been accepted",
  Packed: "has been packed",
  Pending: "is currently pending/delayed",
  "Out For Delivery": "is out for delivery",
  Delivered: "has been delivered",
  Rejected: "has been rejected",
};

exports.sendOrderStatusNotification = onDocumentWritten(
  "customers/{customerUid}/orders/{orderId}",
  async (event) => {
    const change = event.data;
    if (!change) return;

    const beforeData = change.before.exists ? change.before.data() || {} : {};
    const afterData = change.after.data() || {};
    const oldStatus = beforeData.status;
    const newStatus = afterData.status;

    const previousShopStatuses = new Map(
      (Array.isArray(beforeData.orderedShops) ? beforeData.orderedShops : [])
        .map((shop) => [String(shop.shopId || ""), shop.status || "Order Placed"])
    );
    const changedShop = (Array.isArray(afterData.orderedShops) ? afterData.orderedShops : [])
      .find((shop) =>
        previousShopStatuses.get(String(shop.shopId || "")) !== (shop.status || "Order Placed")
      );

    if (oldStatus === newStatus && !changedShop) {
      console.log("Order status did not change. Ignoring notification.");
      return;
    }

    const notificationStatus = changedShop?.status || newStatus;
    const title = STATUS_TITLES[notificationStatus];
    const actionText = STATUS_MESSAGES[notificationStatus];
    if (!title || !actionText) {
      console.log("Unknown order status:", newStatus);
      return;
    }

    const { customerUid, orderId } = event.params;
    const customerRef = db.collection("customers").doc(customerUid);
    const customerSnapshot = await customerRef.get();
    const fcmToken = customerSnapshot.data()?.fcmToken;

    if (!customerSnapshot.exists || typeof fcmToken !== "string" || !fcmToken.trim()) {
      console.log("No valid FCM token found for customer:", customerUid);
      return;
    }

    try {
      await messaging.send({
        token: fcmToken,
        data: {
          orderId: String(orderId),
          status: String(notificationStatus),
          shopId: String(changedShop?.shopId || ""),
          shopName: String(changedShop?.shopName || ""),
          screen: "TrackOrderScreen",
          title,
          body: changedShop?.shopName
            ? `Your order ${orderId} from ${changedShop.shopName} ${actionText}.`
            : `Your order ${orderId} ${actionText}.`,
        },
        android: { priority: "high" },
      });
    } catch (error) {
      console.error("Order notification failed:", error);

      if (
        error.code === "messaging/registration-token-not-registered" ||
        error.code === "messaging/invalid-registration-token"
      ) {
        await customerRef.set({ fcmToken: null }, { merge: true });
      }
    }
  }
);

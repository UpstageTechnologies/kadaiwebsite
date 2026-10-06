const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

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

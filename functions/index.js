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

    if (oldStatus === newStatus) {
      console.log("Order status did not change. Ignoring notification.");
      return;
    }

    const title = STATUS_TITLES[newStatus];
    const actionText = STATUS_MESSAGES[newStatus];
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
          status: String(newStatus),
          screen: "TrackOrderScreen",
          title,
          body: `Your order ${orderId} ${actionText}.`,
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

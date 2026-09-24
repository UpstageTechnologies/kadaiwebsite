const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

const STATUS_TITLES = {
  Accepted: "Order Accepted",
  Packed: "Order Packed",
  Pending: "Order Delayed",
  "Out For Delivery": "Out For Delivery",
  Delivered: "Order Delivered",
  Rejected: "Order Rejected",
};

const STATUS_MESSAGES = {
  Accepted: "has been accepted",
  Packed: "has been packed",
  Pending: "is currently pending/delayed",
  "Out For Delivery": "is out for delivery",
  Delivered: "has been delivered",
  Rejected: "has been rejected",
};

exports.sendOrderStatusNotification = onDocumentUpdated(
  "customers/{customerUid}/orders/{orderId}",
  async (event) => {
    const change = event.data;
    if (!change) return;

    const beforeData = change.before.data() || {};
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

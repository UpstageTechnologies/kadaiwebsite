import { doc, setDoc } from "firebase/firestore";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";

import { db, firebaseApp, firebaseConfig } from "./firebase";

const SERVICE_WORKER_PATH = "/firebase-messaging-sw.js";
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

const getMessageData = (payload) => payload?.data || {};

const getNotificationContent = (payload) => {
  const data = getMessageData(payload);
  const notification = payload?.notification || {};

  return {
    orderId: String(data.orderId || ""),
    status: String(data.status || ""),
    screen: String(data.screen || "TrackOrderScreen"),
    title: data.title || notification.title || "Kadai order update",
    body: data.body || notification.body || "Your order status has changed.",
  };
};

const registerMessagingWorker = async () => {
  if (!("serviceWorker" in navigator)) return null;

  const configQuery = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  });

  return navigator.serviceWorker.register(
    `${SERVICE_WORKER_PATH}?${configQuery.toString()}`
  );
};

const saveToken = async (uid, token) => {
  if (!db || !uid || !token) return false;

  await setDoc(doc(db, "customers", uid), { fcmToken: token }, { merge: true });
  return true;
};

const showForegroundNotification = (payload, navigate) => {
  const content = getNotificationContent(payload);

  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }

  const notification = new Notification(content.title, {
    body: content.body,
    tag: content.orderId || "kadai-order-update",
    data: content,
  });

  notification.onclick = () => {
    notification.close();
    if (content.orderId) {
      navigate(`/track-order/${encodeURIComponent(content.orderId)}`);
    }
  };
};

export const initializeWebNotifications = async ({ uid, navigate }) => {
  if (!uid || !firebaseApp || !db || typeof window === "undefined") {
    return () => {};
  }

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    console.info("[FCM] Browser notifications are not supported.");
    return () => {};
  }

  try {
    if (!(await isSupported())) {
      console.info("[FCM] Firebase messaging is not supported in this browser.");
      return () => {};
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.info("[FCM] Notification permission was not granted.");
      return () => {};
    }

    const serviceWorkerRegistration = await registerMessagingWorker();
    const messaging = getMessaging(firebaseApp);
    const tokenOptions = { serviceWorkerRegistration };
    if (VAPID_KEY) {
      tokenOptions.vapidKey = VAPID_KEY;
    }
    const token = await getToken(messaging, tokenOptions);

    if (token) {
      await saveToken(uid, token);
    } else {
      console.warn("[FCM] No registration token was available.");
    }

    return onMessage(messaging, (payload) => {
      showForegroundNotification(payload, navigate);
    });
  } catch (error) {
    console.warn("[FCM] Web notifications could not be initialized:", error);
    return () => {};
  }
};

export const clearInvalidNotificationToken = async (uid) => {
  if (!db || !uid) return;
  await setDoc(doc(db, "customers", uid), { fcmToken: null }, { merge: true });
};

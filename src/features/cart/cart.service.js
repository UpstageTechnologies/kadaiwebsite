import { onSnapshot, runTransaction } from "firebase/firestore";
import { auth, db, firebaseCustomerDoc } from "../../services/firebase";

/**
 * Cart Feature Service
 * Handles cart calculations and operations
 */

/**
 * Calculate subtotal from cart items
 * @param {Array} cartItems - Array of cart items
 * @returns {number} Subtotal amount
 */
export const calculateSubtotal = (cartItems) => {
  return cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
};

/**
 * Calculate delivery charge
 * @param {number} subtotal - Order subtotal
 * @returns {number} Delivery charge
 */
export const calculateDeliveryCharge = (subtotal) => {
  return subtotal > 0 ? 40 : 0;
};

/**
 * Calculate total price
 * @param {Array} cartItems - Array of cart items
 * @returns {number} Total price including delivery
 */
export const calculateTotal = (cartItems) => {
  const subtotal = calculateSubtotal(cartItems);
  const delivery = calculateDeliveryCharge(subtotal);
  return subtotal + delivery;
};

/**
 * Get cart summary
 * @param {Array} cartItems - Array of cart items
 * @returns {Object} Cart summary object
 */
export const getCartSummary = (cartItems) => {
  const subtotal = calculateSubtotal(cartItems);
  const delivery = calculateDeliveryCharge(subtotal);
  const total = subtotal + delivery;

  return {
    itemCount: cartItems.length,
    totalQuantity: cartItems.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    delivery,
    total,
  };
};

export const subscribeCustomerCart = ({ uid, onItems, onError }) => {
  if (!uid || auth?.currentUser?.uid !== uid) {
    onError?.(new Error("Your Firebase session is missing. Please log in again."));
    return () => {};
  }

  const customerRef = firebaseCustomerDoc(uid);
  if (!db || !customerRef) {
    onError?.(new Error("Firebase Firestore is temporarily unavailable."));
    return () => {};
  }

  return onSnapshot(
    customerRef,
    (snapshot) => {
      const customerData = snapshot.exists() ? snapshot.data() || {} : {};
      onItems?.(Array.isArray(customerData.cartItems) ? customerData.cartItems : []);
    },
    (error) => {
      console.error("[CART] Customer cart listener failed:", error);
      onError?.(error);
    }
  );
};

export const updateCustomerCart = async (uid, updateItems) => {
  if (!uid || auth?.currentUser?.uid !== uid) {
    throw new Error("Your Firebase session is missing. Please log in again.");
  }

  if (!db) {
    throw new Error("Firebase Firestore is temporarily unavailable.");
  }

  const customerRef = firebaseCustomerDoc(uid);
  if (!customerRef) {
    throw new Error("Firebase Firestore is temporarily unavailable.");
  }

  await runTransaction(db, async (transaction) => {
    const customerSnapshot = await transaction.get(customerRef);
    if (!customerSnapshot.exists()) {
      throw new Error("Customer profile not found. Please complete registration first.");
    }

    const customerData = customerSnapshot.data() || {};
    const currentItems = Array.isArray(customerData.cartItems)
      ? customerData.cartItems
      : [];
    transaction.update(customerRef, { cartItems: updateItems(currentItems) });
  });
};

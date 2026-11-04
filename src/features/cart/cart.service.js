import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { auth, db } from "../../services/firebase";

/**
 * Cart Feature Service
 * Handles cart calculations and operations
 */

const toNumber = (value) => {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
};

export const normalizeFirestoreCartItems = (items) => {
  if (Array.isArray(items)) {
    return items
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const itemId = String(item.id ?? item.productId ?? "");
        if (!itemId) {
          return null;
        }

        return {
          ...item,
          id: itemId,
          quantity: toNumber(item.quantity ?? item.qty ?? 0),
          price: toNumber(item.price ?? 0),
          shopName: item.shopName || item.storeName || "Store",
          shopId: item.shopId || item.sellerId || "",
          sellerId: item.sellerId || item.shopId || "",
        };
      })
      .filter(Boolean);
  }

  if (!items || typeof items !== "object") {
    return [];
  }

  return Object.entries(items)
    .map(([key, item]) => {
      const source = item && typeof item === "object" ? item : {};
      const itemId = String(source.id ?? source.productId ?? key);
      if (!itemId) {
        return null;
      }

      return {
        ...source,
        id: itemId,
        quantity: toNumber(source.quantity ?? source.qty ?? 0),
        price: toNumber(source.price ?? 0),
        shopName: source.shopName || source.storeName || "Store",
        shopId: source.shopId || source.sellerId || "",
        sellerId: source.sellerId || source.shopId || "",
      };
    })
    .filter(Boolean);
};

export const serializeCartItemsForFirestore = (items) => {
  const nextItems = {};

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const itemId = String(item.id ?? item.productId ?? "");
    if (!itemId) {
      return;
    }

    const quantity = toNumber(item.quantity ?? item.qty ?? 0);
    nextItems[itemId] = {
      ...item,
      id: itemId,
      productId: itemId,
      quantity,
      qty: quantity,
      price: toNumber(item.price ?? 0),
      image: item.image || item.imageUrl || "",
      name: item.name || "",
      shopName: item.shopName || item.storeName || "Store",
      shopId: item.shopId || item.sellerId || "",
      sellerId: item.sellerId || item.shopId || "",
    };
  });

  return nextItems;
};

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

  if (!db) {
    onError?.(new Error("Firebase Firestore is temporarily unavailable."));
    return () => {};
  }

  const cartDocRef = doc(db, "customers", uid, "cart", "mainCart");

  return onSnapshot(
    cartDocRef,
    (snapshot) => {
      const cartData = snapshot.exists() ? snapshot.data() || {} : {};
      const items = normalizeFirestoreCartItems(cartData.items || []);
      onItems?.(items);
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

  const cartDocRef = doc(db, "customers", uid, "cart", "mainCart");

  await runTransaction(db, async (transaction) => {
    const cartSnapshot = await transaction.get(cartDocRef);
    const currentItems = normalizeFirestoreCartItems(
      cartSnapshot.exists() ? cartSnapshot.data()?.items || {} : []
    );
    const nextItems = updateItems(currentItems);
    const serializedItems = serializeCartItemsForFirestore(nextItems);

    if (Object.keys(serializedItems).length === 0) {
      transaction.delete(cartDocRef);
      return;
    }

    transaction.set(
      cartDocRef,
      {
        items: serializedItems,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  });
};

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

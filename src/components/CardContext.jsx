import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import {
  getCartSummary,
  subscribeCustomerCart,
  updateCustomerCart,
} from "../features/cart/cart.service";

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [isCartLoading, setIsCartLoading] = useState(true);
  const [cartError, setCartError] = useState("");
  const [pendingProductIds, setPendingProductIds] = useState([]);
  const pendingProductIdsRef = useRef(new Set());

  useEffect(() => {
    if (!auth) return undefined;

    let active = true;
    let unsubscribeCart = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeCart();
      unsubscribeCart = () => {};
      setCartItems([]);
      setCartError("");

      if (!firebaseUser?.uid) {
        setIsCartLoading(false);
        return;
      }

      setIsCartLoading(true);
      unsubscribeCart = subscribeCustomerCart({
        uid: firebaseUser.uid,
        onItems: (items) => {
          if (!active || auth.currentUser?.uid !== firebaseUser.uid) return;
          setCartItems(items);
          setCartError("");
          setIsCartLoading(false);
        },
        onError: (error) => {
          if (!active || auth.currentUser?.uid !== firebaseUser.uid) return;
          setCartError(error?.message || "Unable to sync your cart. Please try again.");
          setIsCartLoading(false);
        },
      });
    });

    return () => {
      active = false;
      unsubscribeCart();
      unsubscribeAuth();
    };
  }, []);

  const updateCart = async (updateItems) => {
    const uid = auth?.currentUser?.uid;
    if (!uid) {
      setCartError("Please sign in to add items to your cart.");
      return false;
    }

    setCartError("");
    try {
      await updateCustomerCart(uid, updateItems);
      return true;
    } catch (error) {
      console.error("[CART] Cart update failed:", error);
      setCartError(error?.message || "Unable to update your cart. Please try again.");
      return false;
    }
  };

  const addToCart = async (product) => {
    if (!product?.id) {
      setCartError("This product cannot be added to your cart.");
      return false;
    }

    const productId = String(product.id);
    if (pendingProductIdsRef.current.has(productId)) return false;

    pendingProductIdsRef.current.add(productId);
    setPendingProductIds((current) => [...current, productId]);

    try {
      return await updateCart((items) => {
        const existing = items.find((item) => String(item.id) === productId);
        if (existing) {
          return items.map((item) => String(item.id) === productId
            ? { ...item, quantity: Number(item.quantity || 0) + 1 }
            : item);
        }

        return [...items, { ...product, quantity: 1 }];
      });
    } finally {
      pendingProductIdsRef.current.delete(productId);
      setPendingProductIds((current) => current.filter((id) => id !== productId));
    }
  };

  const increaseQuantity = (productId) => updateCart((items) =>
    items.map((item) => String(item.id) === String(productId)
      ? { ...item, quantity: Number(item.quantity || 0) + 1 }
      : item)
  );

  const decreaseQuantity = (productId) => updateCart((items) =>
    items
      .map((item) => String(item.id) === String(productId)
        ? { ...item, quantity: Number(item.quantity || 0) - 1 }
        : item)
      .filter((item) => Number(item.quantity) > 0)
  );

  const removeFromCart = (productId) => updateCart((items) =>
    items.filter((item) => String(item.id) !== String(productId))
  );

  const clearCart = () => updateCart(() => []);

  const cartCount = cartItems.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  );
  const cartSummary = getCartSummary(cartItems);
  const isAddingToCart = (productId) => pendingProductIds.includes(String(productId));


  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        increaseQuantity,
        decreaseQuantity,
        removeFromCart,
        clearCart,
        cartCount,
        cartSummary,
        isCartLoading,
        cartError,
        clearCartError: () => setCartError(""),
        isAddingToCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );

};


// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => {
  return useContext(CartContext);
};
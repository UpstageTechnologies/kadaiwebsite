import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    const savedCart =
      localStorage.getItem("cartItems");

    return savedCart
      ? JSON.parse(savedCart)
      : [];
  });

  useEffect(() => {
    localStorage.setItem(
      "cartItems",
      JSON.stringify(cartItems)
    );
  }, [cartItems]);

  const addToCart = (product) => {
    setCartItems((prevItems) => {

      const existingProduct =
        prevItems.find(
          (item) => item.id === product.id
        );

      if (existingProduct) {

        return prevItems.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity:
                  item.quantity + 1,
              }
            : item
        );

      }

      return [
        ...prevItems,
        {
          ...product,
          quantity: 1,
        },
      ];

    });
  };

  const increaseQuantity = (productId) => {

    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.id === productId
          ? {
              ...item,
              quantity:
                item.quantity + 1,
            }
          : item
      )
    );

  };

  const decreaseQuantity = (productId) => {

    setCartItems((prevItems) =>
      prevItems
        .map((item) =>
          item.id === productId
            ? {
                ...item,
                quantity:
                  item.quantity - 1,
              }
            : item
        )
        .filter(
          (item) => item.quantity > 0
        )
    );

  };

  const removeFromCart = (productId) => {

    setCartItems((prevItems) =>
      prevItems.filter(
        (item) => item.id !== productId
      )
    );

  };

  const clearCart = () => {
    setCartItems([]);
  };

  const cartCount = cartItems.reduce(
    (total, item) =>
      total + item.quantity,
    0
  );


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
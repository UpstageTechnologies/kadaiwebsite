import {
  FiMinus,
  FiPlus,
  FiTrash2,
  FiArrowLeft,
  FiShoppingCart,
} from "react-icons/fi";

import { useNavigate } from "react-router-dom";
import { useCart } from "../components/CardContext";

import "./Cart.css";
import Navbar from "../components/Navbar";

const Cart = () => {
  const navigate = useNavigate();

  const {
    cartItems,
    removeFromCart,
    increaseQuantity,
    decreaseQuantity,
  } = useCart();
  const subtotal = cartItems.reduce(
    (total, item) =>
      total + item.price * item.quantity,
    0
  );

  const delivery = subtotal > 0 ? 40 : 0;
  const total = subtotal + delivery;

  return (
    <>
    <Navbar/>
    <main className="cart-page">

      <div className="cart-header">

        <button
          className="back-btn"
          onClick={() => navigate("/products")}
        >
          <FiArrowLeft />
          Continue Shopping
        </button>

        <div>
          <h1>Shopping Cart</h1>

          <p>
            {cartItems.length}{" "}
            {cartItems.length === 1
              ? "product"
              : "products"}{" "}
            in your cart
          </p>
        </div>

      </div>

      {cartItems.length === 0 ? (

        <div className="empty-cart">

          <FiShoppingCart
            className="empty-cart-icon"
          />

          <h2>Your Cart is Empty</h2>

          <p>
            You haven't added any products yet.
          </p>

          <button
            onClick={() =>
              navigate("/products")
            }
          >
            Start Shopping
          </button>

        </div>

      ) : (

        <div className="cart-layout">

          <section className="cart-items-section">

            <div className="cart-items-header">
              <h2>Your Items</h2>

              <span>
                {cartItems.reduce(
                  (total, item) =>
                    total + item.quantity,
                  0
                )}{" "}
                items
              </span>
            </div>

            <div className="cart-items">

              {cartItems.map((item) => {

                const itemSubtotal =
                  item.price * item.quantity;

                return (
                  <div
                    className="cart-item"
                    key={item.id}
                  >

                    <div className="cart-item-image">
                      <img
                        src={item.image}
                        alt={item.name}
                      />
                    </div>

                    <div className="cart-item-details">

                      <h3>
                        {item.name}
                      </h3>

                      <p>
                        {item.description}
                      </p>

                      <span className="item-price">
                        ₹{item.price.toFixed(2)}
                        {item.unit &&
                          ` / ${item.unit}`}
                      </span>

                    </div>

                    <div className="quantity-control">

                      <button
                        onClick={() =>
                          decreaseQuantity(
                            item.id
                          )
                        }
                      >
                        <FiMinus />
                      </button>

                      <span>
                        {item.quantity}
                      </span>

                      <button
                        onClick={() =>
                          increaseQuantity(
                            item.id
                          )
                        }
                      >
                        <FiPlus />
                      </button>

                    </div>

                    <div className="item-subtotal">

                      <strong>
                        ₹
                        {itemSubtotal.toFixed(2)}
                      </strong>

                      <button
                        className="remove-btn"
                        onClick={() =>
                          removeFromCart(
                            item.id
                          )
                        }
                      >
                        <FiTrash2 />
                      </button>

                    </div>

                  </div>
                );
              })}

            </div>

          </section>

          <aside className="cart-summary">

            <h2>Order Summary</h2>

            <div className="summary-row">
              <span>Subtotal</span>

              <strong>
                ₹{subtotal.toFixed(2)}
              </strong>
            </div>

            <div className="summary-row">
              <span>Delivery</span>

              <strong>
                ₹{delivery.toFixed(2)}
              </strong>
            </div>

            <div className="summary-divider"></div>

            <div className="summary-total">
              <span>Total</span>

              <strong>
                ₹{total.toFixed(2)}
              </strong>
            </div>

            <button
              className="checkout-btn"
              onClick={() =>
                navigate("/checkout")
              }
            >
              Proceed to Checkout
            </button>

            <button
              className="continue-shopping-btn"
              onClick={() =>
                navigate("/products")
              }
            >
              Continue Shopping
            </button>

          </aside>

        </div>

      )}

    </main>
    </>
  );
};

export default Cart;
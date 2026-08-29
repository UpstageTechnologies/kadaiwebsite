import {
  FiStar,
  FiShoppingCart,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { offers } from "../../data/offers";
import { useCart } from "../../components/CardContext";

import "./offers.css";
import Navbar from "../../components/Navbar";

const Offers = () => {
  const navigate = useNavigate();

  const {
    cartItems,
    addToCart,
    increaseQuantity,
    decreaseQuantity,
  } = useCart();

  const getQuantity = (id) => {
    const cartItem = cartItems.find(
      (item) => item.id === id
    );

    return cartItem
      ? cartItem.quantity
      : 0;
  };

  const handleProductClick = (id) => {
    navigate(`/product/${id}`);
  };

  return (
    <>
    <Navbar/>
    <main className="offers-page">
      <div className="offers-header">
        <span className="offers-small-title">
          Special Deals
        </span>

        <h1>
          Offers
        </h1>

        <p>
          Grab the best deals and save more
          on your favourite products.
        </p>

      </div>
      {offers.length > 0 ? (

        <div className="offers-grid">

          {offers.map((offer) => {

            const quantity =
              getQuantity(offer.id);

            return (

              <article
                className="offer-card"
                key={offer.id}

                onClick={() =>
                  handleProductClick(
                    offer.id
                  )
                }
              >

                <div className="offer-image-box">

                  {offer.offerText && (
                    <span className="offer-badge">
                      {offer.offerText}
                    </span>
                  )}

                  <img
                    src={offer.image}
                    alt={offer.name}
                  />

                </div>

                <div className="offer-content">

                  <span className="offer-category">
                    {offer.category}
                  </span>

                  <h3>
                    {offer.name}
                  </h3>

                  <p className="offer-description">
                    {offer.description}
                  </p>


                  {/* RATING */}

                  <div className="offer-rating">

                    <FiStar />

                    <span>
                      {offer.rating}
                    </span>

                  </div>


                  {/* BOTTOM */}

                  <div className="offer-bottom">

                    {/* PRICE */}

                    <div className="offer-price">

                      <strong>
                        ₹
                        {offer.price.toFixed(2)}
                      </strong>

                      {offer.oldPrice && (
                        <del>
                          ₹
                          {offer.oldPrice.toFixed(
                            2
                          )}
                        </del>
                      )}

                      <small>
                        / {offer.unit}
                      </small>

                    </div>


                    {/* CART */}

                    {quantity === 0 ? (

                      <button
                        type="button"
                        className="offer-cart-btn"

                        onClick={(event) => {

                          event.stopPropagation();

                          addToCart(offer);

                        }}
                      >

                        <FiShoppingCart />

                      </button>

                    ) : (

                      <div
                        className="offer-quantity-control"

                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >

                        {/* DECREASE */}

                        <button
                          type="button"

                          onClick={() =>
                            decreaseQuantity(
                              offer.id
                            )
                          }
                        >
                          −
                        </button>


                        {/* QUANTITY */}

                        <span>
                          {quantity}
                        </span>


                        {/* INCREASE */}

                        <button
                          type="button"

                          onClick={() =>
                            increaseQuantity(
                              offer.id
                            )
                          }
                        >
                          +
                        </button>

                      </div>

                    )}

                  </div>

                </div>

              </article>
            );
          })}

        </div>

      ) : (
        <div className="no-offers">

          <h2>
            No Offers Available
          </h2>

          <p>
            There are no active offers right now.
          </p>

        </div>

      )}

    </main>
    </>
  );
};

export default Offers;

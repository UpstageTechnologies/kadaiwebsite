import { useParams, useNavigate } from "react-router-dom";

import {
  FiArrowLeft,
  FiShoppingCart,
  FiStar,
} from "react-icons/fi";

import { products } from "../data/category";
import { useCart } from "../components/CardContext";

import "./ProductCard.css";
import Navbar from "../components/Navbar";

const ProductCard = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    cartItems,
    addToCart,
    increaseQuantity,
    decreaseQuantity,
  } = useCart();
  const product = products.find(
    (item) => String(item.id) === String(id)
  );

  if (!product) {
    return (
      <section className="product-details-page">

        <div className="product-not-found">

          <h2>
            Product Not Found
          </h2>

          <button
            className="back-to-products-btn"
            onClick={() =>
              navigate("/products")
            }
          >
            <FiArrowLeft />

            <span>
              Back to Products
            </span>
          </button>

        </div>

      </section>
    );
  }

  const cartItem = cartItems.find(
    (item) =>
      item.id === product.id
  );

  return (
    <>
    <Navbar/>
    <section className="product-details-page">
      <button
        className="product-back-btn"
        onClick={() => navigate(-1)}
      >
        <FiArrowLeft />

        <span>
          Back
        </span>
      </button>

      <div className="product-details-card">

        <div className="product-details-image">

          <img
            src={product.image}
            alt={product.name}
          />

        </div>

        <div className="product-details-info">

          <span className="details-category">
            {product.category}
          </span>

          <h1>
            {product.name}
          </h1>

          <div className="product-details-rating">

            <FiStar />

            <span>
              {product.rating}
            </span>

            <span className="rating-text">
              Customer Rating
            </span>

          </div>

          <p className="product-details-description">
            {product.description}
          </p>


          {/* PRICE */}

          <div className="product-details-price">

            <span className="details-old-price">
              ₹{product.oldPrice.toFixed(2)}
            </span>

            <strong>
              ₹{product.price.toFixed(2)}
            </strong>

            <span className="details-unit">
              / {product.unit}
            </span>

          </div>


          {/* PRODUCT INFO */}

          <div className="product-extra-info">

            <div>
              <span>
                Category
              </span>

              <strong>
                {product.category}
              </strong>
            </div>

            <div>
              <span>
                Unit
              </span>

              <strong>
                {product.unit}
              </strong>
            </div>

          </div>

          {cartItem ? (

            <div className="product-details-quantity">

              {/* MINUS */}

              <button
                type="button"
                onClick={() =>
                  decreaseQuantity(
                    product.id
                  )
                }
              >
                −
              </button>


              {/* QUANTITY */}

              <span>
                {cartItem.quantity}
              </span>


              {/* PLUS */}

              <button
                type="button"
                onClick={() =>
                  increaseQuantity(
                    product.id
                  )
                }
              >
                +
              </button>

            </div>

          ) : (

            <button
              className="product-details-add-btn"
              onClick={() =>
                addToCart(product)
              }
            >
              <FiShoppingCart />

              <span>
                Add to Cart
              </span>
            </button>

          )}

        </div>

      </div>

    </section>
    </>
  );
};

export default ProductCard;
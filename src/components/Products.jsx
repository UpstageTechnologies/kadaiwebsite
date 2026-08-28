import { useState } from "react";
import {
  FiShoppingCart,
  FiStar,
  FiChevronLeft,
  FiChevronRight,
  FiArrowRight,
} from "react-icons/fi";

import { products } from "../data/category";

import "../index.css";
import { useCart } from "./CardContext";
import { useNavigate } from "react-router-dom";

const Products = () => {
  const navigate = useNavigate();

  const {
    cartItems,
    addToCart,
    increaseQuantity,
    decreaseQuantity,
  } = useCart();

  const productsPerPage = 8;

  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);

  const totalPages = Math.ceil(
    products.length / productsPerPage
  );

  const startIndex =
    (currentPage - 1) * productsPerPage;

  const endIndex =
    startIndex + productsPerPage;

  const visibleProducts = showAll
    ? products
    : products.slice(startIndex, endIndex);

  const getProductQuantity = (productId) => {
    const cartItem = cartItems.find(
      (item) => item.id === productId
    );

    return cartItem ? cartItem.quantity : 0;
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);

    document
      .querySelector(".products-section")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  const handleViewAll = () => {
    setShowAll(true);
  };

  return (
    <section className="products-section">

      <div className="products-header">

        <div className="products-heading">

          <span>
            Shop Everything You Need
          </span>

          <h2>
            Our Products
          </h2>

          <p>
            Fresh groceries, daily essentials and local shop
            products delivered to your doorstep.
          </p>

        </div>

        {/* VIEW ALL */}

        {!showAll && (
          <button
            className="view-all-btn"
            onClick={() => navigate("/products")}
          >
            View All Products

            <span>
              <FiArrowRight />
            </span>
          </button>
        )}

      </div>

      <div className="products-grid">

        {visibleProducts.map((product) => {

          const quantity = getProductQuantity(
            product.id
          );

          return (
            <article
              className="product-card"
              key={product.id}
              onClick={()=> navigate(`/product/${product.id}`) }
            >

              <div className="product-image-box">

                <span className="product-category">
                  {product.category}
                </span>

                <img
                  src={product.image}
                  alt={product.name}
                />

              </div>


              <div className="product-info">

                {/* RATING */}

                <div className="product-rating">

                  <FiStar />

                  <span>
                    {product.rating}
                  </span>

                </div>


                {/* NAME */}

                <h3>
                  {product.name}
                </h3>


                {/* DESCRIPTION */}

                <p>
                  {product.description}
                </p>

                <div className="product-bottom">

                  {/* PRICE */}

                  <div className="product-price">

                    <span className="old-price">
                      ₹
                      {product.oldPrice.toFixed(2)}
                    </span>

                    <strong>
                      ₹
                      {product.price.toFixed(2)}
                    </strong>

                    <small>
                      / {product.unit}
                    </small>

                  </div>

                  {quantity === 0 ? (

                    /* ADD BUTTON */

                    <button
                      className="add-product-btn"
                      aria-label={`Add ${product.name} to cart`}
                      onClick={(event) => {

                        event.stopPropagation();

                        addToCart(product);

                      }}
                    >

                      <span>
                        Add
                      </span>

                      <FiShoppingCart />

                    </button>

                  ) : (

                    /* QUANTITY CONTROL */

                    <div
                      className="product-quantity-control"
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                    >

                      {/* DECREASE */}

                      <button
                        type="button"
                        onClick={() =>
                          decreaseQuantity(product.id)
                        }
                        aria-label={`Decrease ${product.name} quantity`}
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
                          increaseQuantity(product.id)
                        }
                        aria-label={`Increase ${product.name} quantity`}
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
      {!showAll && totalPages > 1 && (

        <div className="products-pagination">

          {/* PREVIOUS */}

          <button
            className="pagination-arrow"
            onClick={() =>
              handlePageChange(
                currentPage - 1
              )
            }
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <FiChevronLeft />
          </button>


          {/* PAGE NUMBERS */}

          {Array.from(
            { length: totalPages },
            (_, index) => index + 1
          ).map((page) => (

            <button
              key={page}
              className={`pagination-number ${
                currentPage === page
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handlePageChange(page)
              }
            >
              {page}
            </button>

          ))}


          {/* NEXT */}

          <button
            className="pagination-arrow"
            onClick={() =>
              handlePageChange(
                currentPage + 1
              )
            }
            disabled={
              currentPage === totalPages
            }
            aria-label="Next page"
          >
            <FiChevronRight />
          </button>

        </div>

      )}

      {showAll && (

        <button
          className="show-less-btn"
          onClick={() => {

            setShowAll(false);
            setCurrentPage(1);

            document
              .querySelector(".products-section")
              ?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });

          }}
        >
          Show Less
        </button>

      )}

    </section>
  );
};

export default Products;
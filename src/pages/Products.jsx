import { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  FiStar,
  FiShoppingCart,
} from "react-icons/fi";

import { useCart } from "../components/CardContext";

import {
  categories,
  products,
} from "../data/category";

import "./Products.css";
import Navbar from "../components/Navbar";


const Products = () => {

  const navigate = useNavigate();

  const {
    cartItems,
    addToCart,
    increaseQuantity,
    decreaseQuantity,
  } = useCart();


  const [searchParams] =
    useSearchParams();


  const categoryFromURL =
    searchParams.get("category");

  // SEARCH
  const searchFromURL =
    searchParams.get("search") || "";


  const [selectedCategory, setSelectedCategory] =
    useState(
      categoryFromURL || "All Products"
    );

    useEffect(()=>{
      setSelectedCategory(
        categoryFromURL|| "All Products"
      )
    }, [categoryFromURL])


  // FILTER PRODUCTS
  const filteredProducts = useMemo(() => {

    let result = products;


    // CATEGORY FILTER
    if (
      selectedCategory !==
      "All Products"
    ) {

      result = result.filter(
        (product) =>
          product.category ===
          selectedCategory
      );

    }


    // SEARCH FILTER
    if (searchFromURL.trim()) {

      const searchText =
        searchFromURL
          .toLowerCase()
          .trim();


      result = result.filter(
        (product) =>
          product.name
            .toLowerCase()
            .includes(searchText) ||

          product.category
            .toLowerCase()
            .includes(searchText) ||

          product.description
            .toLowerCase()
            .includes(searchText)
      );

    }


    return result;

  }, [
    selectedCategory,
    searchFromURL,
  ]);


  const handleCategoryChange = (
    category
  ) => {

    setSelectedCategory(category);


    if (
      category ===
      "All Products"
    ) {

      navigate("/products");

    } else {

      navigate(
        `/products?category=${encodeURIComponent(
          category
        )}`
      );

    }

  };


  const handleProductClick = (id) => {

    navigate(`/product/${id}`);

  };


  return (
    <>
    <Navbar/>

    <main className="products-page">

      <div className="products-header">

        <div>

          <h1>
            Our Products
          </h1>

          <p>
            Find everything you need from your
            local stores
          </p>

        </div>

      </div>


      <div className="products-layout">


        {/* SIDEBAR */}

        <aside className="products-sidebar">

          <h3>
            Select Category
          </h3>


          <div className="category-list">

            {categories.map(
              (category) => {

                const categoryCount =
                  category ===
                  "All Products"

                    ? products.length

                    : products.filter(
                        (product) =>
                          product.category ===
                          category
                      ).length;


                return (

                  <button
                    key={category}

                    className={
                      selectedCategory ===
                      category
                        ? "category-item active"
                        : "category-item"
                    }

                    onClick={() =>
                      handleCategoryChange(
                        category
                      )
                    }
                  >

                    <span>
                      {category}
                    </span>

                  </button>

                );

              }
            )}

          </div>

        </aside>


        {/* PRODUCTS CONTENT */}

        <section className="products-content">


          {/* TOP BAR */}

          <div className="products-topbar">

            <div>

              <h2>

                {searchFromURL
                  ? `Search results for "${searchFromURL}"`
                  : selectedCategory}

              </h2>


              <p>

                {filteredProducts.length}{" "}
                items available

              </p>

            </div>

          </div>


          {/* PRODUCTS */}

          {filteredProducts.length > 0 ? (

            <div className="products-grid">


              {filteredProducts.map(
                (product) => {

                  const cartItem =
                    cartItems.find(
                      (item) =>
                        item.id ===
                        product.id
                    );


                  return (

                    <article
                      className="product-card"

                      key={product.id}

                      onClick={() =>
                        navigate(
                          `/product/${product.id}`
                        )
                      }
                    >


                      {/* IMAGE */}

                      <div className="product-image-wrapper">

                        <img
                          src={product.image}
                          alt={product.name}
                          className="product-image"
                        />

                      </div>


                      {/* DETAILS */}

                      <div className="product-details">


                        {/* CATEGORY */}

                        <span className="product-category">

                          {product.category}

                        </span>


                        {/* NAME */}

                        <h3>

                          {product.name}

                        </h3>


                        {/* DESCRIPTION */}

                        <p className="product-description">

                          {product.description}

                        </p>


                        {/* RATING */}

                        <div className="product-rating">

                          <FiStar
                            className="star-icon"
                            size={14}
                            fill="currentColor"
                          />

                          <span>

                            {product.rating}

                          </span>

                        </div>


                        {/* BOTTOM */}

                        <div className="product-bottom">


                          {/* PRICE */}

                          <div className="price-section">

                            <strong>

                              ₹
                              {product.price.toFixed(
                                2
                              )}

                            </strong>


                            {product.oldPrice && (

                              <del>

                                ₹
                                {product.oldPrice.toFixed(
                                  2
                                )}

                              </del>

                            )}

                          </div>


                          {/* CART */}

                          {cartItem ? (

                            <div
                              className="product-quantity-control"

                              onClick={(event) =>
                                event.stopPropagation()
                              }
                            >


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
                              type="button"

                              className="add-cart-btn"

                              onClick={(event) => {

                                event.stopPropagation();

                                addToCart(product);

                              }}
                            >

                              <FiShoppingCart
                                size={17}
                              />

                            </button>

                          )}

                        </div>

                      </div>

                    </article>

                  );

                }
              )}

            </div>

          ) : (

            <div className="no-products">

              <h3>

                {searchFromURL
                  ? "Product Not Found"
                  : "No Products Found"}

              </h3>


              <p>

                {searchFromURL

                  ? `Sorry, we couldn't find "${searchFromURL}".`

                  : "There are no products in this category."

                }

              </p>


              <button
                onClick={() =>
                  handleCategoryChange(
                    "All Products"
                  )
                }
              >

                View All Products

              </button>

            </div>

          )}

        </section>

      </div>

    </main>

    </>
  );

};


export default Products;
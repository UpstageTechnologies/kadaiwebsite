import { useEffect, useMemo, useState } from "react";
import {
  FiShoppingCart,
  FiStar,
  FiChevronLeft,
  FiChevronRight,
  FiArrowRight,
} from "react-icons/fi";
import { doc, onSnapshot } from "firebase/firestore";

import "../index.css";
import { useCart } from "./CardContext";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import {
  getAddressCoordinates,
  getNearbySellerIds,
  MARKET_MODES,
  subscribeMarketplaceProducts,
  subscribeSellerLocations,
} from "../services/marketplace.service";
import { db } from "../services/firebase";

const Products = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    cartItems,
    addToCart,
    increaseQuantity,
    decreaseQuantity,
    isAddingToCart,
  } = useCart();

  const productsPerPage = 8;

  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [localProducts, setLocalProducts] = useState([]);
  const [sellerLocations, setSellerLocations] = useState({});
  const [customerLocation, setCustomerLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(user));

  useEffect(() => {
    if (!user?.uid || !db) {
      setCustomerLocation(null);
      return undefined;
    }

    const customerRef = doc(db, "customers", user.uid);
    const unsubscribe = onSnapshot(
      customerRef,
      (snapshot) => {
        const customerData = snapshot.data() || {};
        setCustomerLocation(getAddressCoordinates(customerData?.address || customerData));
      },
      () => setCustomerLocation(null)
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    const unsubscribe = subscribeSellerLocations({
      onLocations: setSellerLocations,
      onError: () => setSellerLocations({}),
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setIsLoading(Boolean(user));

    if (!user?.uid) {
      setLocalProducts([]);
      return undefined;
    }

    const unsubscribe = subscribeMarketplaceProducts({
      marketMode: MARKET_MODES.LOCAL,
      onProducts: (products) => {
        setLocalProducts(Array.isArray(products) ? products : []);
        setIsLoading(false);
      },
      onError: () => {
        setLocalProducts([]);
        setIsLoading(false);
      },
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const nearbySellerIds = useMemo(
    () => getNearbySellerIds(customerLocation, sellerLocations),
    [customerLocation, sellerLocations]
  );

  const filteredLocalProducts = useMemo(() => {
    if (!nearbySellerIds.length) {
      return [];
    }

    return localProducts.filter((product) =>
      nearbySellerIds.includes(product.shopId || product.sellerId)
    );
  }, [localProducts, nearbySellerIds]);

  const totalPages = Math.ceil(filteredLocalProducts.length / productsPerPage);

  const startIndex = (currentPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const visibleProducts = showAll
    ? filteredLocalProducts
    : filteredLocalProducts.slice(startIndex, endIndex);

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
    navigate("/products?market=global");
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

        {!showAll && (
          <button
            className="view-all-btn"
            onClick={handleViewAll}
          >
            View All Products

            <span>
              <FiArrowRight />
            </span>
          </button>
        )}

      </div>

      {isLoading ? (
        <div className="no-products">
          <h3>Loading nearby products...</h3>
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="no-products">
          <h3>No local products available within 3 KM</h3>
          <p>Try the global catalog for more products from other stores.</p>
        </div>
      ) : (
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

                  <div className="product-rating">

                    <FiStar />

                    <span>
                      {product.rating}
                    </span>

                  </div>

                  <h3>
                    {product.name}
                  </h3>

                  <p>
                    {product.description}
                  </p>

                  <div className="product-bottom">

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

                      <button
                        className="add-product-btn"
                        disabled={isAddingToCart(product.id)}
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

                      <div
                        className="product-quantity-control"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >

                        <button
                          type="button"
                          onClick={() =>
                            decreaseQuantity(product.id)
                          }
                          aria-label={`Decrease ${product.name} quantity`}
                        >
                          −
                        </button>

                        <span>
                          {quantity}
                        </span>

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
      )}

      {!showAll && !isLoading && filteredLocalProducts.length > 8 && (

        <div className="products-pagination">

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
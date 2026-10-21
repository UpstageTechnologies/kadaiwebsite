import { useEffect, useMemo, useState } from "react";
import {
  FiShoppingBag,
  FiShoppingCart,
  FiStar,
  FiChevronLeft,
  FiChevronRight,
  FiArrowRight,
} from "react-icons/fi";
import "../index.css";
import { useCart } from "./CardContext";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import {
  getAddressCoordinates,
  getNearbySellerIds,
  MARKET_MODES,
  subscribeMarketplaceProducts,
  subscribeMarketplaceSellerProfiles,
} from "../services/marketplace.service";

const Products = () => {
  const navigate = useNavigate();
  const { user, customer, loading: isAuthLoading } = useAuth();

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
  const [productState, setProductState] = useState({
    uid: "",
    products: [],
  });
  const [sellerProfiles, setSellerProfiles] = useState([]);
  const [sellerProfilesLoaded, setSellerProfilesLoaded] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState("");
  const localProducts = useMemo(
    () => productState.uid === (user?.uid || "") ? productState.products : [],
    [productState.products, productState.uid, user?.uid]
  );
  const isLoading = Boolean(user?.uid) && productState.uid !== user.uid;

  const customerLocation = useMemo(
    () => getAddressCoordinates(customer?.address),
    [customer?.address]
  );

  useEffect(() => {
    const unsubscribe = subscribeMarketplaceSellerProfiles({
      onSellers: (sellers) => {
        setSellerProfiles(sellers);
        setSellerProfilesLoaded(true);
      },
      onError: () => {
        setSellerProfiles([]);
        setSellerProfilesLoaded(true);
      },
    });

    return () => unsubscribe();
  }, []);

  const sellerLocations = useMemo(
    () => Object.fromEntries(
      sellerProfiles
        .filter((seller) => seller.coordinates)
        .map((seller) => [seller.id, seller.coordinates])
    ),
    [sellerProfiles]
  );

  useEffect(() => {
    const uid = user?.uid || "";
    if (!uid) {
      return undefined;
    }

    const unsubscribe = subscribeMarketplaceProducts({
      marketMode: MARKET_MODES.LOCAL,
      onProducts: (products) => {
        setProductState({
          uid,
          products: Array.isArray(products) ? products : [],
        });
      },
      onError: () => {
        setProductState({ uid, products: [] });
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

    const uniqueProducts = new Map();

    localProducts
      .filter((product) =>
        nearbySellerIds.includes(product.shopId || product.sellerId)
      )
      .forEach((product) => {
        const productKey = `${product.shopId || product.sellerId}:${product.id}`;
        if (!uniqueProducts.has(productKey)) {
          uniqueProducts.set(productKey, product);
        }
      });

    return [...uniqueProducts.values()];
  }, [localProducts, nearbySellerIds]);

  const eligibleShops = useMemo(() => {
    const shopIdsWithProducts = new Set(
      filteredLocalProducts.map((product) => product.shopId || product.sellerId)
    );

    return sellerProfiles.filter((seller) =>
      shopIdsWithProducts.has(seller.id) && nearbySellerIds.includes(seller.id)
    );
  }, [filteredLocalProducts, nearbySellerIds, sellerProfiles]);

  const activeSelectedShopId = eligibleShops.some((shop) => shop.id === selectedShopId)
    ? selectedShopId
    : "";
  const displayedLocalProducts = useMemo(
    () => activeSelectedShopId
      ? filteredLocalProducts.filter((product) =>
        String(product.shopId || product.sellerId || "") === activeSelectedShopId
      )
      : filteredLocalProducts,
    [activeSelectedShopId, filteredLocalProducts]
  );

  const totalPages = Math.ceil(displayedLocalProducts.length / productsPerPage);
  const activePage = Math.min(currentPage, Math.max(totalPages, 1));
  const startIndex = (activePage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const visibleProducts = showAll
    ? displayedLocalProducts
    : displayedLocalProducts.slice(startIndex, endIndex);

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

      {isAuthLoading ? (
        <div className="no-products" role="status">
          <h3>Loading nearby products...</h3>
        </div>
      ) : !user ? (
        <div className="no-products">
          <h3>To view the local products, please log in.</h3>
          <button
            type="button"
            className="local-products-login-btn"
            onClick={() => navigate(`/login?redirect=${encodeURIComponent("/")}`)}
          >
            Log In
            <span>
              <FiArrowRight />
            </span>
          </button>
        </div>
      ) : (
        <>
      <section aria-label="Local Shops" style={{ margin: "0 0 32px" }}>
        <div style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}>
          <h2 style={{ color: "#20252a", fontSize: "24px", fontWeight: 800, margin: 0 }}>
            Local Shops
          </h2>
          {activeSelectedShopId && (
            <button
              type="button"
              onClick={() => {
                setSelectedShopId("");
                setCurrentPage(1);
              }}
              style={{
                background: "transparent",
                border: "1px solid #079866",
                borderRadius: "6px",
                color: "#079866",
                cursor: "pointer",
                fontWeight: 700,
                padding: "9px 14px",
              }}
            >
              All Shops
            </button>
          )}
        </div>
        {sellerProfilesLoaded && eligibleShops.length > 0 ? (
          <div style={{
            display: "grid",
            gap: "12px",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
          }}>
            {eligibleShops.map((shop) => (
              <button
                type="button"
                key={shop.id}
                aria-pressed={activeSelectedShopId === shop.id}
                onClick={() => {
                  setSelectedShopId(shop.id);
                  setCurrentPage(1);
                }}
                style={{
                  alignItems: "center",
                  background: activeSelectedShopId === shop.id ? "#079866" : "#ffffff",
                  border: "1px solid #dce5dc",
                  borderRadius: "6px",
                  color: activeSelectedShopId === shop.id ? "#ffffff" : "#20252a",
                  cursor: "pointer",
                  display: "flex",
                  gap: "8px",
                  justifyContent: "center",
                  fontWeight: 700,
                  minHeight: "48px",
                  padding: "8px 12px",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    alignItems: "center",
                    background: "#f0f8f4",
                    border: "1px solid #edf0ee",
                    borderRadius: "50%",
                    color: "#079866",
                    display: "inline-flex",
                    flex: "0 0 28px",
                    height: "28px",
                    justifyContent: "center",
                    overflow: "hidden",
                    position: "relative",
                    width: "28px",
                  }}
                >
                  <FiShoppingBag />
                  {shop.image && (
                    <img
                      src={shop.image}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                      style={{
                        borderRadius: "50%",
                        height: "100%",
                        inset: 0,
                        objectFit: "cover",
                        position: "absolute",
                        width: "100%",
                      }}
                    />
                  )}
                </span>
                {shop.shopName}
              </button>
            ))}
          </div>
        ) : sellerProfilesLoaded ? (
          <p>No eligible local shops found.</p>
        ) : (
          <p>Loading local shops...</p>
        )}
      </section>

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
                activePage - 1
              )
            }
            disabled={activePage === 1}
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
                activePage === page
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
                activePage + 1
              )
            }
            disabled={
              activePage === totalPages
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
        </>
      )}

    </section>
  );
};

export default Products;
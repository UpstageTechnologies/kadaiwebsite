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
  getCustomerActiveLocation,
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
    subscriptionKey: "",
    products: [],
    error: "",
  });
  const [sellerProfiles, setSellerProfiles] = useState([]);
  const [sellerProfilesLoaded, setSellerProfilesLoaded] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState("");
  const customerLocation = useMemo(
    () => getCustomerActiveLocation(customer),
    [customer]
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
      sellerProfiles.map((seller) => [seller.id, seller.addressData || seller.coordinates || seller])
    ),
    [sellerProfiles]
  );

  const nearbySellerIds = useMemo(
    () => getNearbySellerIds(customerLocation, sellerLocations),
    [customerLocation, sellerLocations]
  );
  const subscriptionKey = JSON.stringify([user?.uid || "", nearbySellerIds]);
  const localProducts = useMemo(
    () => productState.subscriptionKey === subscriptionKey ? productState.products : [],
    [productState.products, productState.subscriptionKey, subscriptionKey]
  );
  const localProductError = productState.subscriptionKey === subscriptionKey
    ? productState.error
    : "";
  const isLoading = Boolean(user?.uid)
    && (productState.subscriptionKey !== subscriptionKey || !sellerProfilesLoaded);

  useEffect(() => {
    const uid = user?.uid || "";
    if (!uid) {
      return undefined;
    }

    const unsubscribe = subscribeMarketplaceProducts({
      marketMode: MARKET_MODES.LOCAL,
      sellerIds: nearbySellerIds,
      onProducts: (products) => {
        setProductState({
          subscriptionKey,
          products: Array.isArray(products) ? products : [],
          error: "",
        });
      },
      onError: (error) => {
        setProductState({
          subscriptionKey,
          products: [],
          error: error?.message || "Unable to load local products. Please try again.",
        });
      },
    });

    return () => unsubscribe();
  }, [nearbySellerIds, subscriptionKey, user?.uid]);

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

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const productCountsBySeller = {};
    let matchedSellerInventoryCount = 0;
    let outOfStockInventoryCount = 0;
    localProducts.forEach((product) => {
      const sellerId = String(product.shopId || product.sellerId || "");
      productCountsBySeller[sellerId || "(missing)"] =
        (productCountsBySeller[sellerId || "(missing)"] || 0) + 1;
      if (nearbySellerIds.includes(sellerId)) matchedSellerInventoryCount += 1;
      if (product.quantity <= 0) outOfStockInventoryCount += 1;
    });

    console.debug("[MARKET DEBUG] home local product filtering", {
      customerLocation: {
        country: customerLocation?.country || "",
        state: customerLocation?.state || "",
        district: customerLocation?.district || "",
        city: customerLocation?.city || "",
        hasCoordinates: Boolean(customerLocation?.lat != null && customerLocation?.lon != null),
      },
      sellerProfileCount: sellerProfiles.length,
      nearbySellerIds,
      inventoryProductCount: localProducts.length,
      inventoryProductCountsBySeller: productCountsBySeller,
      matchedSellerInventoryCount,
      inventoryQuantityPositiveCount: localProducts.length - outOfStockInventoryCount,
      inventoryQuantityZeroOrLessCount: outOfStockInventoryCount,
      productsRemovedByAvailabilityFilter: 0,
      matchingLocalProductCount: filteredLocalProducts.length,
    });
  }, [
    customerLocation,
    filteredLocalProducts,
    localProducts,
    nearbySellerIds,
    sellerProfiles.length,
  ]);

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

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    console.debug("[MARKET DEBUG] home local render counts", {
      matchedSellerCount: nearbySellerIds.length,
      eligibleShopCount: eligibleShops.length,
      inventoryProductCount: localProducts.length,
      matchingProductCount: filteredLocalProducts.length,
      displayedProductCount: visibleProducts.length,
    });
  }, [
    eligibleShops.length,
    filteredLocalProducts.length,
    localProducts.length,
    nearbySellerIds.length,
    visibleProducts.length,
  ]);

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
      <section className="home-local-shops" aria-label="Available Shops">
        <div className="home-local-shops-header">
          <h2>Available Shops</h2>
          {activeSelectedShopId && (
            <button
              type="button"
              onClick={() => {
                setSelectedShopId("");
                setCurrentPage(1);
              }}
              className="home-local-shops-clear"
            >
              All Shops
            </button>
          )}
        </div>
        {isLoading ? (
          <p>Loading local shops...</p>
        ) : localProductError ? (
          <p>Unable to load local shops.</p>
        ) : eligibleShops.length > 0 ? (
          <div className="home-local-shops-list">
            {eligibleShops.map((shop) => (
              <button
                type="button"
                key={shop.id}
                aria-pressed={activeSelectedShopId === shop.id}
                className="home-local-shop-option"
                onClick={() => {
                  setSelectedShopId(shop.id);
                  setCurrentPage(1);
                }}
              >
                <span className="home-local-shop-image" aria-hidden="true">
                  <FiShoppingBag />
                  {(shop.localImage || shop.image) && (
                    <img
                      src={shop.localImage || shop.image}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                    />
                  )}
                </span>
                <span className="home-local-shop-name">{shop.shopName}</span>
              </button>
            ))}
          </div>
        ) : sellerProfilesLoaded ? (
          <p>No eligible local shops found.</p>
        ) : (
          <p>Loading local shops...</p>
        )}
      </section>

      <div className="home-local-products-title">
        <h2 className="home-local-products-heading">Local</h2>
        {!isLoading && (
          <p className="home-local-products-count">
            {displayedLocalProducts.length} {displayedLocalProducts.length === 1 ? "product" : "products"} available
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="no-products">
          <h3>Loading nearby products...</h3>
        </div>
      ) : localProductError ? (
        <div className="no-products">
          <h3>{localProductError}</h3>
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="no-products">
          <h3>No local products available for this address.</h3>
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
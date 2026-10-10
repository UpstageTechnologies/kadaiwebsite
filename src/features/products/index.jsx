import { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  FiShoppingBag,
  FiStar,
  FiShoppingCart,
} from "react-icons/fi";

import { useCart } from "../../components/CardContext";
import { useAuth } from "../../components/AuthContext";
import {
  db,
} from "../../services/firebase";
import {
  DEFAULT_MARKET_MODE,
  MARKET_MODES,
  getMarketplaceCoordinates,
  getNearbySellerIds,
  haversineDistanceKm,
  subscribeMarketplaceProducts,
  subscribeMarketplaceSellerProfiles,
} from "../../services/marketplace.service";
import { doc, onSnapshot } from "firebase/firestore";

import "./products.css";
import Navbar from "../../components/Navbar";

const Products = () => {
  const navigate = useNavigate();
  const { user, loading: isAuthLoading } = useAuth();

  const {
    cartItems,
    addToCart,
    increaseQuantity,
    decreaseQuantity,
    isAddingToCart,
  } = useCart();

  const [searchParams, setSearchParams] = useSearchParams();

  const searchFromURL = searchParams.get("search") || "";
  const categoryFromURL = searchParams.get("category") || "";
  const requestedMarketMode = searchParams.get("market");

  const marketMode = categoryFromURL
    ? MARKET_MODES.GLOBAL
    : requestedMarketMode === MARKET_MODES.GLOBAL
      ? MARKET_MODES.GLOBAL
      : DEFAULT_MARKET_MODE;
  const userId = user?.uid || "";
  const [customerLocationState, setCustomerLocationState] = useState({
    userId: "",
    coordinates: null,
    error: "",
  });
  const customerLocation = customerLocationState.userId === userId
    ? customerLocationState.coordinates
    : null;
  const isCustomerLocationLoading = Boolean(
    userId && db && customerLocationState.userId !== userId
  );
  const locationError = customerLocationState.userId === userId
    ? customerLocationState.error
    : "";
  const [sellerState, setSellerState] = useState({
    sellers: [],
    loaded: false,
    error: "",
  });
  const sellerProfiles = sellerState.sellers;
  const isSellerProfilesLoading = Boolean(db) && !sellerState.loaded;
  const sellerProfilesError = !db
    ? "Firebase is not configured. We couldn't load shops."
    : sellerState.error;
  const [selectedShopSelection, setSelectedShopSelection] = useState(null);
  const selectedShopId = selectedShopSelection?.marketMode === marketMode
    ? selectedShopSelection.id
    : "";
  const [productState, setProductState] = useState({
    marketMode: "",
    products: [],
    error: "",
  });
  const isLoading = Boolean(db) && productState.marketMode !== marketMode;
  const error = !db
    ? "Firebase is not configured. We couldn't load products."
    : productState.marketMode === marketMode
      ? productState.error
      : "";

  useEffect(() => {
    if (isAuthLoading) return;
    if (
      marketMode === MARKET_MODES.LOCAL &&
      !user
    ) {
      navigate(
        `/login?redirect=${encodeURIComponent("/products?market=local")}`,
        { replace: true }
      );
    }
  }, [isAuthLoading, marketMode, navigate, user]);

  useEffect(() => {
    if (!userId || !db) return undefined;

    const customerRef = doc(db, "customers", userId);
    let isActive = true;
    const unsubscribe = onSnapshot(
      customerRef,
      (snapshot) => {
        if (!isActive) return;
        const customerData = snapshot.data() || {};
        const coordinates = getMarketplaceCoordinates(customerData.address)
          || getMarketplaceCoordinates(customerData.currentLocation)
          || getMarketplaceCoordinates(customerData);
        setCustomerLocationState({ userId, coordinates, error: "" });
      },
      (listenerError) => {
        if (!isActive) return;
        console.error("[MARKET] Customer location listener failed:", listenerError);
        setCustomerLocationState({
          userId,
          coordinates: null,
          error: "We couldn't load your saved location. Please try again.",
        });
      }
    );

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    if (!db) return undefined;

    let isActive = true;
    const unsubscribe = subscribeMarketplaceSellerProfiles({
      onSellers: (sellers) => {
        if (!isActive) return;
        setSellerState({ sellers, loaded: true, error: "" });
      },
      onError: (listenerError) => {
        if (!isActive) return;
        setSellerState({
          sellers: [],
          loaded: true,
          error: "We couldn't load shops right now. Please try again later.",
        });
        console.error("[MARKET] Seller profiles failed:", listenerError);
      },
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  const sellerLocationMap = useMemo(
    () => Object.fromEntries(
      sellerProfiles
        .filter((seller) => seller.coordinates)
        .map((seller) => [seller.id, seller.coordinates])
    ),
    [sellerProfiles]
  );
  const nearbySellerIds = useMemo(
    () => getNearbySellerIds(customerLocation, sellerLocationMap),
    [customerLocation, sellerLocationMap]
  );
  useEffect(() => {
    if (!db) return undefined;

    let isActive = true;
    const mode = marketMode === MARKET_MODES.GLOBAL ? MARKET_MODES.GLOBAL : MARKET_MODES.LOCAL;
    let listenerErrorMessage = "";

    const unsubscribe = subscribeMarketplaceProducts({
      marketMode: mode,
      onProducts: (products) => {
        if (!isActive) return;
        setProductState({
          marketMode: mode,
          products,
          error: listenerErrorMessage,
        });
      },
      onError: (listenerError) => {
        if (!isActive) return;
        listenerErrorMessage = "We couldn't load products right now. Please try again later.";
        setProductState({
          marketMode: mode,
          products: [],
          error: listenerErrorMessage,
        });
        console.error("[MARKET] Product listener failed:", listenerError);
      },
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [marketMode]);

  const activeProducts = useMemo(() => {
    const source = productState.marketMode === marketMode ? productState.products : [];
    const uniqueProducts = new Map();

    source.forEach((product) => {
      const shopId = String(product.shopId || product.sellerId || "");
      if (!shopId || (marketMode === MARKET_MODES.LOCAL
        && (!customerLocation || !nearbySellerIds.includes(shopId)))) {
        return;
      }

      const productKey = `${shopId}:${product.id}`;
      if (!uniqueProducts.has(productKey)) {
        uniqueProducts.set(productKey, product);
      }
    });

    return [...uniqueProducts.values()];
  }, [customerLocation, marketMode, nearbySellerIds, productState]);

  const filteredProducts = useMemo(() => {
    let result = activeProducts;

    if (searchFromURL.trim()) {
      const searchText = searchFromURL.toLowerCase().trim();

      result = result.filter((product) => {
        const name = String(product.name || "").toLowerCase();
        const itemNo = String(product.itemNo || "").toLowerCase();
        const category = String(product.category || "").toLowerCase();
        const description = String(product.description || "").toLowerCase();

        return (
          name.includes(searchText) ||
          itemNo.includes(searchText) ||
          category.includes(searchText) ||
          description.includes(searchText)
        );
      });
    }

    if (marketMode === MARKET_MODES.GLOBAL && categoryFromURL) {
      const selectedCategory = categoryFromURL.trim().toLowerCase();

      result = result.filter(
        (product) =>
          String(product.category || "").trim().toLowerCase() ===
          selectedCategory
      );
    }

    return result;
  }, [activeProducts, categoryFromURL, marketMode, searchFromURL]);

  const eligibleShops = useMemo(() => {
    const productCounts = new Map();
    filteredProducts.forEach((product) => {
      const shopId = String(product.shopId || product.sellerId || "");
      if (shopId) {
        productCounts.set(shopId, (productCounts.get(shopId) || 0) + 1);
      }
    });

    return sellerProfiles
      .filter((seller) => productCounts.has(seller.id))
      .filter((seller) => marketMode !== MARKET_MODES.LOCAL
        || nearbySellerIds.includes(seller.id))
      .map((seller) => ({
        ...seller,
        productCount: productCounts.get(seller.id),
        distanceKm: marketMode === MARKET_MODES.LOCAL && customerLocation && seller.coordinates
          ? haversineDistanceKm(
            customerLocation.lat,
            customerLocation.lon,
            seller.coordinates.lat,
            seller.coordinates.lon
          )
          : null,
      }));
  }, [customerLocation, filteredProducts, marketMode, nearbySellerIds, sellerProfiles]);

  const selectedShopProfile = sellerProfiles.find((seller) =>
    seller.id === selectedShopId
    && (marketMode !== MARKET_MODES.LOCAL || nearbySellerIds.includes(seller.id))
  ) || null;
  const selectedShop = selectedShopProfile;
  const selectedShopProducts = selectedShop
    ? filteredProducts.filter((product) =>
      String(product.shopId || product.sellerId || "") === selectedShop.id
    )
    : [];
  const displayedProducts = selectedShop ? selectedShopProducts : filteredProducts;
  const isPageLoading = isLoading
    || isSellerProfilesLoading
    || (marketMode === MARKET_MODES.LOCAL && (isCustomerLocationLoading || isAuthLoading));

  const handleMarketChange = (nextMode) => {
    if (
      nextMode === MARKET_MODES.LOCAL &&
      !user
    ) {
      navigate(
        `/login?redirect=${encodeURIComponent("/products?market=local")}`
      );
      return;
    }

    setSelectedShopSelection(null);

    const nextSearchParams = new URLSearchParams(searchParams);

    if (nextMode === MARKET_MODES.LOCAL) {
      nextSearchParams.delete("category");
    }

    nextSearchParams.set("market", nextMode);

    setSearchParams(nextSearchParams, { replace: true });
  };

  return (
    <>
      <Navbar />

      <main className="products-page">
        <div className="products-header">
          <div>
            <h1>Our Products</h1>
            <p>Find everything you need from your local stores</p>
          </div>
        </div>

        <div className="products-layout">
          <aside className="products-sidebar">
            <h3>Select Market</h3>

            <div className="category-list">
              {Object.values(MARKET_MODES).map((mode) => (
                <button
                  key={mode}
                  className={marketMode === mode ? "category-item active" : "category-item"}
                  onClick={() => handleMarketChange(mode)}
                >
                  <span>{mode === MARKET_MODES.LOCAL ? "Nearby" : "All Stores"}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="products-content">
            <div className="products-topbar">
              <div>
                <h2>
                  {searchFromURL
                    ? `Search results for "${searchFromURL}"`
                    : marketMode === MARKET_MODES.LOCAL
                      ? "Local"
                      : "Global"}
                </h2>
                <p>{displayedProducts.length} items available</p>
              </div>
            </div>

            {(error || sellerProfilesError || locationError) && (
              <div className="no-products">
                <p>{error || sellerProfilesError || locationError}</p>
              </div>
            )}

            {!error && !sellerProfilesError && !locationError && isPageLoading && (
              <div className="no-products">
                <h3>Loading products...</h3>
              </div>
            )}

            {!error && !sellerProfilesError && !locationError
              && !isPageLoading
              && marketMode === MARKET_MODES.LOCAL
              && !customerLocation ? (
                <div className="no-products">
                  <h3>Location coordinates needed</h3>
                  <p>
                    Local shops can only be shown when your saved address has latitude and longitude.
                    Update your address from the profile menu; GPS will not be requested automatically.
                  </p>
                </div>
              ) : null}

            {!error && !sellerProfilesError && !locationError
              && !isPageLoading
              && (marketMode !== MARKET_MODES.LOCAL || customerLocation)
              ? (
                <section className="shop-selector" aria-label="Select a shop">
                  <div className="shop-selector-header">
                    <h3>Shop by store</h3>
                    {selectedShop && (
                      <button
                        type="button"
                        onClick={() => setSelectedShopSelection(null)}
                      >
                        Clear selection
                      </button>
                    )}
                  </div>
                  {eligibleShops.length > 0 ? (
                    <div className="shop-selector-list">
                      {eligibleShops.map((shop) => (
                        <button
                          type="button"
                          className={`shop-selector-item${selectedShopId === shop.id ? " selected" : ""}`}
                          key={shop.id}
                          aria-pressed={selectedShopId === shop.id}
                          onClick={() => setSelectedShopSelection({
                            id: shop.id,
                            marketMode,
                          })}
                        >
                          <span className="shop-selector-icon">
                            <FiShoppingBag aria-hidden="true" />
                          </span>
                          <span className="shop-selector-name">{shop.shopName}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="shop-selector-empty">No eligible shops found.</p>
                  )}
                </section>
              ) : null}

            {!error && !sellerProfilesError && !locationError
              && !isPageLoading
              && (marketMode !== MARKET_MODES.LOCAL || customerLocation)
              && displayedProducts.length > 0 ? (
              <div className="products-grid">
                {displayedProducts.map((product) => {
                  const cartItem = cartItems.find((item) => item.id === product.id);

                  return (
                    <article
                      className="product-card"
                      key={product.id}
                      onClick={() => navigate(`/product/${product.id}`)}
                    >
                      <div className="product-image-wrapper">
                        <img src={product.image} alt={product.name} className="product-image" />
                        <span className="shop-badge">{product.shopName || "Store"}</span>
                      </div>

                      <div className="product-details">
                        <h3>{product.name}</h3>

                        <p className="product-description">{product.description}</p>

                        <div className="product-rating">
                          <FiStar className="star-icon" size={14} fill="currentColor" />
                          <span>{product.rating}</span>
                        </div>

                        <div className="product-bottom">
                          <div className="price-section">
                            <strong>₹{Number(product.price || 0).toFixed(2)}</strong>
                            {product.oldPrice && <del>₹{Number(product.oldPrice || 0).toFixed(2)}</del>}
                          </div>

                          <div className="product-bottom-actions">
                            {typeof product.quantity === "number" && product.quantity >= 0 && (
                              <span className={`stock-badge ${product.quantity === 0 ? "out" : "in-stock"}`}>
                                {product.quantity === 0 ? "Out of stock" : `Stock: ${product.quantity}`}
                              </span>
                            )}

                            {cartItem ? (
                              <div className="product-quantity-control" onClick={(event) => event.stopPropagation()}>
                                <button type="button" onClick={() => decreaseQuantity(product.id)}>−</button>
                                <span>{cartItem.quantity}</span>
                                <button type="button" onClick={() => increaseQuantity(product.id)}>+</button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="add-cart-btn"
                                disabled={isAddingToCart(product.id)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  addToCart(product);
                                }}
                              >
                                <FiShoppingCart size={17} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}

            {!error && !sellerProfilesError && !locationError
              && !isPageLoading && selectedShop && selectedShopProducts.length === 0 && (
              <div className="no-products">
                <h3>{searchFromURL ? "Product Not Found" : "No Products Available"}</h3>
                <p>
                  {searchFromURL
                    ? `Sorry, we couldn't find "${searchFromURL}" at ${selectedShop.shopName}.`
                    : `${selectedShop.shopName} has no products available right now.`}
                </p>
                <button onClick={() => setSelectedShopSelection(null)}>Clear shop selection</button>
              </div>
            )}

            {!error && !sellerProfilesError && !locationError
              && !isPageLoading && !selectedShop && displayedProducts.length === 0 && (
              <div className="no-products">
                <h3>{searchFromURL ? "Product Not Found" : "No Products Found"}</h3>
                <p>
                  {searchFromURL
                    ? `Sorry, we couldn't find "${searchFromURL}".`
                    : marketMode === MARKET_MODES.LOCAL
                      ? "There are no nearby products in your area right now."
                      : "There are no products in this category."}
                </p>
                <button onClick={() => handleMarketChange(MARKET_MODES.LOCAL)}>View Local Products</button>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
};

export default Products;
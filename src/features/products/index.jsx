                                                                                                                                                                           import { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  FiStar,
  FiShoppingCart,
} from "react-icons/fi";

import { useCart } from "../../components/CardContext";
import {
  db,
} from "../../services/firebase";
import {
  DEFAULT_MARKET_MODE,
  MARKET_MODES,
  getAddressCoordinates,
  getCurrentCustomerUid,
  getNearbySellerIds,
  subscribeMarketplaceProducts,
  subscribeSellerLocations,
} from "../../services/marketplace.service";
import { doc, onSnapshot } from "firebase/firestore";

import "./products.css";
import Navbar from "../../components/Navbar";

const Products = () => {
  const navigate = useNavigate();

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

  const [marketMode, setMarketMode] = useState(
    categoryFromURL || requestedMarketMode === MARKET_MODES.GLOBAL
      ? MARKET_MODES.GLOBAL
      : DEFAULT_MARKET_MODE
  );

  useEffect(() => {
    if (categoryFromURL) {
      setMarketMode(MARKET_MODES.GLOBAL);
      return;
    }

    const nextMode = requestedMarketMode === MARKET_MODES.GLOBAL
      ? MARKET_MODES.GLOBAL
      : DEFAULT_MARKET_MODE;

    setMarketMode(nextMode);
  }, [categoryFromURL, requestedMarketMode]);
  const [inventoryProducts, setInventoryProducts] = useState([]); 
  const [globalProducts, setGlobalProducts] = useState([]);
  const [customerLocation, setCustomerLocation] = useState(null);
  const [sellerLocations, setSellerLocations] = useState({});
  const [nearbySellerIds, setNearbySellerIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (
      marketMode === MARKET_MODES.LOCAL &&
      localStorage.getItem("isLoggedIn") !== "true"
    ) {
      navigate(
        `/login?redirect=${encodeURIComponent("/products?market=local")}`,
        { replace: true }
      );
    }
  }, [marketMode, navigate]);

  useEffect(() => {
    const uid = getCurrentCustomerUid();

    if (!uid || !db) {
      setCustomerLocation(null);
      return undefined;
    }

    const customerRef = doc(db, "customers", uid);
    const unsubscribe = onSnapshot(
      customerRef,
      (snapshot) => {
        const customerData = snapshot.data() || {};
        const coordinates = getAddressCoordinates(customerData);
        setCustomerLocation(coordinates);
      },
      (listenerError) => {
        console.error("[MARKET] Customer location listener failed:", listenerError);
        setCustomerLocation(null);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSellerLocations({
      onLocations: setSellerLocations,
      onError: (listenerError) => {
        console.error("[MARKET] Seller locations failed:", listenerError);
      },
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (marketMode !== MARKET_MODES.LOCAL) {
      setNearbySellerIds([]);
      return;
    }

    if (!customerLocation) {
      setNearbySellerIds([]);
      return;
    }

    const ids = getNearbySellerIds(customerLocation, sellerLocations);
    setNearbySellerIds(ids);
  }, [marketMode, customerLocation, sellerLocations]);

  useEffect(() => {
    setIsLoading(true);
    setError("");

    const mode = marketMode === MARKET_MODES.GLOBAL ? MARKET_MODES.GLOBAL : MARKET_MODES.LOCAL;
    const onProducts = mode === MARKET_MODES.GLOBAL ? setGlobalProducts : setInventoryProducts;

    const unsubscribe = subscribeMarketplaceProducts({
      marketMode: mode,
      onProducts: (products) => {
        onProducts(products);
        setIsLoading(false);
      },
      onError: (listenerError) => {
        setError("We couldn't load products right now. Please try again later.");
        onProducts([]);
        setIsLoading(false);
        console.error("[MARKET] Product listener failed:", listenerError);
      },
    });

    return () => unsubscribe();
  }, [marketMode]);

  const activeProducts = useMemo(() => {
    const source = marketMode === MARKET_MODES.GLOBAL ? globalProducts : inventoryProducts;

    if (marketMode === MARKET_MODES.LOCAL) {
      if (!customerLocation || nearbySellerIds.length === 0) {
        return [];
      }

      return source.filter((product) => nearbySellerIds.includes(product.shopId || product.sellerId));
    }

    return source;
  }, [customerLocation, globalProducts, inventoryProducts, marketMode, nearbySellerIds]);

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

  const handleMarketChange = (nextMode) => {
    if (
      nextMode === MARKET_MODES.LOCAL &&
      localStorage.getItem("isLoggedIn") !== "true"
    ) {
      navigate(
        `/login?redirect=${encodeURIComponent("/products?market=local")}`
      );
      return;
    }

    setMarketMode(nextMode);

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
                <h2>{searchFromURL ? `Search results for "${searchFromURL}"` : marketMode === MARKET_MODES.LOCAL ? "Local" : "Global"}</h2>
                <p>{filteredProducts.length} items available</p>
              </div>
            </div>

            {error && <div className="no-products"><p>{error}</p></div>}

            {!error && isLoading && (
              <div className="no-products">
                <h3>Loading products...</h3>
              </div>
            )}

            {!error && !isLoading && filteredProducts.length > 0 ? (
              <div className="products-grid">
                {filteredProducts.map((product) => {
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

            {!error && !isLoading && filteredProducts.length === 0 && (
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
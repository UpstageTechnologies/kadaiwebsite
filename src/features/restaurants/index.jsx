import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  FiArrowLeft,
  FiClock,
  FiCoffee,
  FiMapPin,
  FiMinus,
  FiPackage,
  FiPlus,
  FiSearch,
  FiShoppingCart,
  FiStar,
  FiX,
} from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../services/firebase";
import { useAuth } from "../../components/AuthContext";
import "./restaurants.css";

const RESTAURANT_CART_STORAGE_KEY = "kadai_restaurant_cart";

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeRestaurant = (restaurantDoc) => {
  if (!restaurantDoc) return null;

  const data = restaurantDoc.data?.() || {};
  const locationSource = data.address || data.shopAddress || data.location || data.shopLocation || {};
  const locationText = [
    locationSource.area,
    locationSource.city,
    locationSource.district,
    locationSource.state,
    locationSource.country,
    locationSource.fullAddress,
    locationSource.address,
  ]
    .filter(Boolean)
    .join(", ") || "Location unavailable";

  return {
    id: restaurantDoc.id,
    name: data.shopName || data.storeName || data.restaurantName || data.name || "Restaurant",
    description: data.description || data.bio || "Fresh food and local favourites.",
    image: data.image || data.logo || data.shopImage || data.coverImage || data.imageUrl || "",
    rating: parseNumber(data.rating || data.averageRating || 4.5, 4.5),
    deliveryTime: data.deliveryTime || data.avgDeliveryTime || "25-35 min",
    category: data.category || data.foodCategory || "Restaurant",
    locationText,
    isOpen: data.isOpen !== undefined ? Boolean(data.isOpen) : undefined,
    address: locationSource,
  };
};

const normalizeMenuItem = (menuDoc) => {
  if (!menuDoc) return null;

  const data = menuDoc.data?.() || {};
  const variants = Array.isArray(data.variants) ? data.variants : [];

  return {
    id: menuDoc.id,
    name: data.name || data.itemName || "Menu item",
    description: data.description || data.itemDescription || "",
    price: parseNumber(data.salesPrice ?? data.price ?? 0, 0),
    category: data.category || "General",
    image: data.imageUrl || data.image || data.img || "",
    isAvailable: data.isAvailable !== false,
    hasVariants: Boolean(data.hasVariants || variants.length),
    variants,
  };
};

const getVariantChoices = (variants = []) => {
  if (!Array.isArray(variants)) return [];

  return variants
    .map((variant, index) => {
      if (typeof variant === "string") {
        return {
          id: `${index}-${variant}`,
          label: variant,
          name: variant,
          price: 0,
        };
      }

      if (variant && typeof variant === "object") {
        return {
          id: variant.id || variant.key || `${index}-${variant.name || variant.label || "variant"}`,
          label: variant.label || variant.name || variant.title || `Variant ${index + 1}`,
          name: variant.name || variant.label || variant.title || `Variant ${index + 1}`,
          price: parseNumber(variant.price || variant.additionalPrice || variant.addonPrice || 0, 0),
        };
      }

      return null;
    })
    .filter(Boolean);
};

const readRestaurantCart = () => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RESTAURANT_CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getRestaurantItemKey = (item) => {
  const itemId = item?.id || "item";
  const restaurantId = item?.restaurantId || item?.shopId || "restaurant";
  const variantId = item?.variant?.id || item?.variant?.name || "default";
  return `${restaurantId}:${itemId}:${variantId}`;
};

const RestaurantCartContext = createContext(null);

export const RestaurantCartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => readRestaurantCart());

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RESTAURANT_CART_STORAGE_KEY, JSON.stringify(cartItems));
    }
  }, [cartItems]);

  useEffect(() => {
    if (!auth || !db) {
      setCartItems(readRestaurantCart());
      return undefined;
    }

    let unsubscribeCart = () => {};
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      unsubscribeCart();
      unsubscribeCart = () => {};

      if (!user?.uid) {
        setCartItems(readRestaurantCart());
        return;
      }

      const cartRef = doc(db, "users", user.uid, "restaurant_cart", "mainCart");
      unsubscribeCart = onSnapshot(
        cartRef,
        (snapshot) => {
          const items = snapshot.exists() ? snapshot.data()?.items || [] : [];
          setCartItems(Array.isArray(items) ? items : []);
        },
        (error) => {
          console.error("[RESTAURANT CART] Listener failed:", error);
        }
      );
    });

    return () => {
      unsubscribeCart();
      unsubscribeAuth();
    };
  }, []);

  const saveCart = async (nextItems) => {
    const normalized = (Array.isArray(nextItems) ? nextItems : []).map((item) => ({
      ...item,
      quantity: Math.max(1, Number(item.quantity || 1)),
    }));

    setCartItems(normalized);

    if (auth?.currentUser?.uid && db) {
      await setDoc(
        doc(db, "users", auth.currentUser.uid, "restaurant_cart", "mainCart"),
        {
          items: normalized,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    return true;
  };

  const addToCart = async (item) => {
    if (!item?.id) return false;

    const normalizedItem = {
      ...item,
      id: String(item.id),
      quantity: Math.max(1, Number(item.quantity || 1)),
      restaurantId: item.restaurantId || item.shopId || "restaurant",
      restaurantName: item.restaurantName || item.shopName || "Restaurant",
      variant: item.variant || null,
    };

    const nextItems = [...cartItems];
    const itemKey = getRestaurantItemKey(normalizedItem);
    const index = nextItems.findIndex((current) => getRestaurantItemKey(current) === itemKey);

    if (index >= 0) {
      nextItems[index] = {
        ...nextItems[index],
        quantity: Number(nextItems[index].quantity || 0) + Number(normalizedItem.quantity || 1),
      };
    } else {
      nextItems.push(normalizedItem);
    }

    return saveCart(nextItems);
  };

  const increaseQuantity = async (itemKey) => {
    const nextItems = cartItems.map((current) => {
      const currentKey = getRestaurantItemKey(current);
      if (currentKey !== itemKey) return current;
      return { ...current, quantity: Number(current.quantity || 0) + 1 };
    });

    return saveCart(nextItems);
  };

  const decreaseQuantity = async (itemKey) => {
    const nextItems = cartItems
      .map((current) => {
        const currentKey = getRestaurantItemKey(current);
        if (currentKey !== itemKey) return current;
        return { ...current, quantity: Math.max(0, Number(current.quantity || 1) - 1) };
      })
      .filter((current) => Number(current.quantity || 0) > 0);

    return saveCart(nextItems);
  };

  const removeFromCart = async (itemKey) => {
    const nextItems = cartItems.filter((current) => getRestaurantItemKey(current) !== itemKey);
    return saveCart(nextItems);
  };

  const clearCart = async () => saveCart([]);

  const cartSummary = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    const delivery = subtotal > 0 ? 35 : 0;

    return {
      subtotal,
      delivery,
      total: subtotal + delivery,
      itemCount: cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    };
  }, [cartItems]);

  const value = {
    cartItems,
    cartCount: cartSummary.itemCount,
    cartSummary,
    cartError: "",
    setCartError: () => {},
    addToCart,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    clearCart,
  };

  return <RestaurantCartContext.Provider value={value}>{children}</RestaurantCartContext.Provider>;
};

export const useRestaurantCart = () => {
  const context = useContext(RestaurantCartContext);
  if (!context) {
    throw new Error("useRestaurantCart must be used inside RestaurantCartProvider");
  }
  return context;
};

const Restaurants = ({ cartMode = "" }) => {
  const navigate = useNavigate();
  const { restaurantId } = useParams();
  const { user } = useAuth();

  if (cartMode === "cart") return <RestaurantCartPage navigate={navigate} user={user} />;
  if (cartMode === "checkout") return <RestaurantCheckoutPage navigate={navigate} user={user} />;
  if (cartMode === "orders") return <RestaurantOrdersPage navigate={navigate} user={user} />;
  if (cartMode === "track-order") return <RestaurantTrackOrderPage navigate={navigate} user={user} />;
  if (restaurantId) return <RestaurantDetailPage restaurantId={restaurantId} navigate={navigate} user={user} />;

  return <RestaurantListPage navigate={navigate} />;
};

const RestaurantListPage = ({ navigate }) => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(Boolean(db));
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    if (!db) {
      setLoading(false);
      setError("Firebase is not configured. We could not load restaurant data.");
      return undefined;
    }

    const restaurantsQuery = query(collection(db, "users"), where("role", "==", "seller"));
    const unsubscribe = onSnapshot(
      restaurantsQuery,
      (snapshot) => {
        const nextRestaurants = snapshot.docs
          .map(normalizeRestaurant)
          .filter(Boolean)
          .sort((left, right) => right.rating - left.rating);

        setRestaurants(nextRestaurants);
        setLoading(false);
        setError("");
      },
      (listenerError) => {
        console.error("[RESTAURANT] Load error:", listenerError);
        setError("We could not load restaurants right now. Please try again later.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const categories = useMemo(() => {
    const set = new Set(["All"]);
    restaurants.forEach((restaurant) => {
      if (restaurant.category) set.add(restaurant.category);
    });
    return [...set];
  }, [restaurants]);

  const filteredRestaurants = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return restaurants.filter((restaurant) => {
      const matchesSearch = !searchValue ||
        restaurant.name.toLowerCase().includes(searchValue) ||
        restaurant.locationText.toLowerCase().includes(searchValue) ||
        restaurant.description.toLowerCase().includes(searchValue);

      const matchesCategory = selectedCategory === "All" || restaurant.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [restaurants, search, selectedCategory]);

  return (
    <main className="restaurants-page">
      <header className="restaurants-topbar">
        <button type="button" className="restaurants-back" onClick={() => navigate(-1)}>
          <FiArrowLeft aria-hidden="true" />
          <span>Back</span>
        </button>
        <Link className="restaurants-brand" to="/experience" aria-label="KadaiApp experiences">
          <span className="restaurants-brand-mark"><FiCoffee /></span>
          <span>Kadai<span>App</span></span>
        </Link>
      </header>

      <section className="restaurants-content" aria-labelledby="restaurants-title">
        <p className="restaurants-eyebrow">A LITTLE SOMETHING DELICIOUS</p>
        <h1 id="restaurants-title">Explore Restaurants</h1>
        <p className="restaurants-description">Find a new favourite and enjoy good food from places around you.</p>

        <div className="restaurants-toolbar">
          <label className="restaurants-search" htmlFor="restaurant-search">
            <FiSearch aria-hidden="true" />
            <input id="restaurant-search" type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search for a restaurant or area" />
          </label>
        </div>

        {categories.length > 1 && (
          <div className="restaurants-category-list" aria-label="Restaurant categories">
            {categories.map((category) => (
              <button key={category} type="button" className={selectedCategory === category ? "restaurant-chip active" : "restaurant-chip"} onClick={() => setSelectedCategory(category)}>
                {category}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="restaurants-state">
            <div className="restaurants-spinner" aria-live="polite" />
            <p>Loading restaurants...</p>
          </div>
        ) : error ? (
          <div className="restaurants-state">
            <span className="restaurants-empty-icon"><FiCoffee aria-hidden="true" /></span>
            <h2>Could not load restaurants</h2>
            <p>{error}</p>
            <Link to="/experience" className="restaurants-return-link">
              <FiArrowLeft aria-hidden="true" />
              Back to experiences
            </Link>
          </div>
        ) : filteredRestaurants.length ? (
          <div className="restaurant-grid">
            {filteredRestaurants.map((restaurant) => (
              <Link key={restaurant.id} to={`/restaurants/${restaurant.id}`} className="restaurant-card">
                <div className="restaurant-card-image-wrap">
                  {restaurant.image ? <img src={restaurant.image} alt={restaurant.name} className="restaurant-card-image" /> : <div className="restaurant-card-placeholder" aria-hidden="true"><FiCoffee /></div>}
                </div>
                <div className="restaurant-card-body">
                  <div className="restaurant-card-header">
                    <h2>{restaurant.name}</h2>
                    {restaurant.isOpen !== undefined && (
                      <span className={restaurant.isOpen ? "restaurant-status open" : "restaurant-status closed"}>
                        {restaurant.isOpen ? "Open" : "Closed"}
                      </span>
                    )}
                  </div>
                  <p className="restaurant-card-location"><FiMapPin aria-hidden="true" /><span>{restaurant.locationText}</span></p>
                  <p className="restaurant-card-description">{restaurant.description}</p>
                  <div className="restaurant-card-meta">
                    <span><FiStar aria-hidden="true" /> {restaurant.rating.toFixed(1)}</span>
                    <span><FiClock aria-hidden="true" /> {restaurant.deliveryTime}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="restaurants-state">
            <span className="restaurants-empty-icon"><FiCoffee aria-hidden="true" /></span>
            <h2>No restaurants found</h2>
            <p>Try another search or select a different category.</p>
            <button type="button" className="restaurants-return-link restaurants-reset-btn" onClick={() => { setSearch(""); setSelectedCategory("All"); }}>
              Clear filters
            </button>
          </div>
        )}
      </section>
    </main>
  );
};

const RestaurantDetailPage = ({ restaurantId, navigate, user }) => {
  const { addToCart, cartItems } = useRestaurantCart();
  const [restaurant, setRestaurant] = useState(null);
  const [restaurantLoading, setRestaurantLoading] = useState(Boolean(db));
  const [restaurantError, setRestaurantError] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(Boolean(db));
  const [menuError, setMenuError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedFood, setSelectedFood] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!db || !restaurantId) {
      setRestaurantLoading(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      doc(db, "users", restaurantId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setRestaurantError("This restaurant could not be found.");
          setRestaurantLoading(false);
          return;
        }

        setRestaurant(normalizeRestaurant(snapshot));
        setRestaurantError("");
        setRestaurantLoading(false);
      },
      (listenerError) => {
        console.error("[RESTAURANT] Restaurant fetch error:", listenerError);
        setRestaurantError("We could not load this restaurant right now.");
        setRestaurantLoading(false);
      }
    );

    return () => unsubscribe();
  }, [restaurantId]);

  useEffect(() => {
    if (!db || !restaurantId) {
      setMenuLoading(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "users", restaurantId, "restaurant_menu"),
      (snapshot) => {
        const nextItems = snapshot.docs
          .map(normalizeMenuItem)
          .filter(Boolean)
          .sort((left, right) => left.name.localeCompare(right.name));

        setMenuItems(nextItems);
        setMenuLoading(false);
        setMenuError("");
      },
      (listenerError) => {
        console.error("[RESTAURANT MENU] Menu fetch error:", listenerError);
        setMenuError("We could not load the restaurant menu right now.");
        setMenuLoading(false);
      }
    );

    return () => unsubscribe();
  }, [restaurantId]);

  useEffect(() => {
    if (!selectedFood) {
      setSelectedVariantId("");
      return;
    }

    const choices = getVariantChoices(selectedFood.variants || []);
    setSelectedVariantId(choices.length ? choices[0].id : "");
  }, [selectedFood]);

  const categories = useMemo(() => {
    const set = new Set(["All"]);
    menuItems.forEach((item) => set.add(item.category));
    return [...set];
  }, [menuItems]);

  const filteredMenuItems = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return menuItems.filter((item) => {
      const matchesSearch = !searchValue || item.name.toLowerCase().includes(searchValue) || item.category.toLowerCase().includes(searchValue) || item.description.toLowerCase().includes(searchValue);
      const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, search, selectedCategory]);

  const selectedVariant = useMemo(() => {
    if (!selectedFood) return null;
    return getVariantChoices(selectedFood.variants || []).find((variant) => variant.id === selectedVariantId) || null;
  }, [selectedFood, selectedVariantId]);

  const closeFoodModal = () => {
    setSelectedFood(null);
    setQuantity(1);
    setSelectedVariantId("");
  };

  const handleQuickAddToCart = async (item) => {
    if (!user) {
      navigate("/login");
      return;
    }

    if (!item?.isAvailable) return;

    const choices = getVariantChoices(item.variants || []);
    if (choices.length > 0) {
      setSelectedFood(item);
      return;
    }

    await addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      restaurantId,
      restaurantName: restaurant?.name || "Restaurant",
      shopId: restaurantId,
      shopName: restaurant?.name || "Restaurant",
      quantity: 1,
      description: item.description,
      category: item.category,
      variant: null,
    });
  };

  const handleAddToCart = async (item) => {
    if (!user) {
      navigate("/login");
      return;
    }

    if (!item.isAvailable) return;

    const success = await addToCart({
      id: selectedVariant ? `${item.id}-${selectedVariant.id}` : item.id,
      name: `${item.name}${selectedVariant ? ` (${selectedVariant.label || selectedVariant.name})` : ""}`,
      price: item.price + (selectedVariant ? selectedVariant.price : 0),
      image: item.image,
      restaurantId,
      restaurantName: restaurant?.name || "Restaurant",
      shopId: restaurantId,
      shopName: restaurant?.name || "Restaurant",
      quantity,
      description: item.description,
      category: item.category,
      variant: selectedVariant,
    });

    if (success) closeFoodModal();
  };

  return (
    <main className="restaurants-page restaurant-detail-page">
      <header className="restaurants-topbar">
        <button type="button" className="restaurants-back" onClick={() => navigate(-1)}>
          <FiArrowLeft aria-hidden="true" />
          <span>Back</span>
        </button>
        <div className="restaurants-brand-area">
          <Link className="restaurants-brand" to="/experience" aria-label="KadaiApp experiences">
            <span className="restaurants-brand-mark"><FiCoffee /></span>
            <span>Kadai<span>App</span></span>
          </Link>
          <button type="button" className="restaurant-cart-button" onClick={() => navigate("/restaurants/cart")}>
            <FiShoppingCart aria-hidden="true" />
            <span>{cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</span>
          </button>
        </div>
      </header>

      {restaurantLoading ? (
        <section className="restaurants-content"><div className="restaurants-state"><div className="restaurants-spinner" aria-live="polite" /><p>Loading restaurant details...</p></div></section>
      ) : restaurantError ? (
        <section className="restaurants-content"><div className="restaurants-state"><span className="restaurants-empty-icon"><FiCoffee aria-hidden="true" /></span><h2>Restaurant not found</h2><p>{restaurantError}</p><button type="button" className="restaurants-return-link restaurants-reset-btn" onClick={() => navigate("/restaurants")}><FiArrowLeft aria-hidden="true" /> Back to restaurants</button></div></section>
      ) : restaurant ? (
        <>
          <section className="restaurant-header-card">
            <div className="restaurant-hero-image-wrap">{restaurant.image ? <img src={restaurant.image} alt={restaurant.name} className="restaurant-hero-image" /> : <div className="restaurant-card-placeholder restaurant-hero-placeholder" aria-hidden="true"><FiCoffee /></div>}</div>
            <div className="restaurant-hero-copy">
              <div className="restaurant-hero-title-row">
                <div>
                  <p className="restaurants-eyebrow restaurant-eyebrow">Restaurant</p>
                  <h1>{restaurant.name}</h1>
                </div>
                {restaurant.isOpen !== undefined && <span className={restaurant.isOpen ? "restaurant-status open" : "restaurant-status closed"}>{restaurant.isOpen ? "Open now" : "Closed"}</span>}
              </div>
              <p className="restaurant-hero-description">{restaurant.description}</p>
              <div className="restaurant-hero-meta">
                <span><FiStar aria-hidden="true" /> {restaurant.rating.toFixed(1)} rating</span>
                <span><FiClock aria-hidden="true" /> {restaurant.deliveryTime}</span>
                <span><FiMapPin aria-hidden="true" /> {restaurant.locationText}</span>
              </div>
              <label className="restaurants-search restaurant-detail-search" htmlFor="restaurant-menu-search">
                <FiSearch aria-hidden="true" />
                <input id="restaurant-menu-search" type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu items" />
              </label>
            </div>
          </section>

          <section className="restaurant-menu-section" aria-labelledby="restaurant-menu-title">
            <div className="restaurant-menu-heading"><div><p className="restaurants-eyebrow">Menu</p><h2 id="restaurant-menu-title">Popular dishes</h2></div></div>
            {categories.length > 1 && (
              <div className="restaurants-category-list restaurant-menu-filters" aria-label="Menu categories">
                {categories.map((category) => (
                  <button key={category} type="button" className={selectedCategory === category ? "restaurant-chip active" : "restaurant-chip"} onClick={() => setSelectedCategory(category)}>
                    {category}
                  </button>
                ))}
              </div>
            )}

            {menuLoading ? (
              <div className="restaurants-state compact-state"><div className="restaurants-spinner" aria-live="polite" /><p>Loading menu...</p></div>
            ) : menuError ? (
              <div className="restaurants-state compact-state"><span className="restaurants-empty-icon"><FiCoffee /></span><h2>Menu unavailable</h2><p>{menuError}</p></div>
            ) : filteredMenuItems.length ? (
              <div className="restaurant-menu-grid">
                {filteredMenuItems.map((item) => (
                  <div key={item.id} className={item.isAvailable ? "restaurant-menu-card" : "restaurant-menu-card disabled"} onClick={() => item.isAvailable && setSelectedFood(item)} onKeyDown={(event) => {
                    if ((event.key === "Enter" || event.key === " ") && item.isAvailable) {
                      event.preventDefault();
                      setSelectedFood(item);
                    }
                  }} role="button" tabIndex={item.isAvailable ? 0 : -1} aria-label={`View ${item.name}`}>
                    <div className="restaurant-menu-image-wrap">{item.image ? <img src={item.image} alt={item.name} className="restaurant-menu-image" /> : <div className="restaurant-card-placeholder" aria-hidden="true"><FiCoffee /></div>}</div>
                    <div className="restaurant-menu-card-body">
                      <div className="restaurant-menu-card-header"><h3>{item.name}</h3>{!item.isAvailable && <span className="restaurant-menu-availability unavailable">Unavailable</span>}</div>
                      <p className="restaurant-menu-category">{item.category}</p>
                      {item.description && <p className="restaurant-menu-description">{item.description}</p>}
                      <div className="restaurant-menu-footer">
                        <span className="restaurant-price">₹{Number(item.price || 0).toFixed(2)}</span>
                        <div className="restaurant-menu-actions">
                          {item.hasVariants && <span className="restaurant-variants">Options</span>}
                          <button
                            type="button"
                            className="restaurant-mini-add-btn"
                            disabled={!item.isAvailable}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (item.hasVariants) {
                                setSelectedFood(item);
                                return;
                              }
                              handleQuickAddToCart(item);
                            }}
                          >
                            Add to cart
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="restaurants-state compact-state" aria-live="polite"><span className="restaurants-empty-icon"><FiCoffee aria-hidden="true" /></span><h2>No food items found</h2><p>Try a different search or category, or check back later for new dishes.</p></div>
            )}
          </section>
        </>
      ) : null}

      {selectedFood && (
        <div className="restaurant-food-modal" role="dialog" aria-modal="true" aria-labelledby="restaurant-food-title" onClick={closeFoodModal}>
          <div className="restaurant-food-modal-card" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="restaurant-modal-close" aria-label="Close food details" onClick={closeFoodModal}><FiX aria-hidden="true" /></button>
            <div className="restaurant-food-modal-image-wrap">{selectedFood.image ? <img src={selectedFood.image} alt={selectedFood.name} className="restaurant-food-modal-image" /> : <div className="restaurant-card-placeholder restaurant-food-placeholder" aria-hidden="true"><FiCoffee /></div>}</div>
            <div className="restaurant-food-modal-copy">
              <div className="restaurant-food-modal-header">
                <div>
                  <p className="restaurant-food-category">{selectedFood.category}</p>
                  <h3 id="restaurant-food-title">{selectedFood.name}</h3>
                </div>
                <span className="restaurant-price">₹{(selectedFood.price + (selectedVariant ? selectedVariant.price : 0)).toFixed(2)}</span>
              </div>
              {selectedFood.description && <p className="restaurant-food-description">{selectedFood.description}</p>}
              {selectedFood.hasVariants && (
                <div className="restaurant-food-options">
                  <p className="restaurant-food-options-label">Choose a variant</p>
                  <div className="restaurant-variant-row">
                    {getVariantChoices(selectedFood.variants || []).map((variant) => (
                      <button key={variant.id} type="button" className={selectedVariantId === variant.id ? "restaurant-variant active" : "restaurant-variant"} onClick={() => setSelectedVariantId(variant.id)}>
                        <span>{variant.label}</span>
                        {variant.price > 0 && <strong>₹{variant.price.toFixed(2)}</strong>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="restaurant-food-footer">
                <div className="restaurant-quantity-picker" aria-label="Select quantity">
                  <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="Decrease quantity"><FiMinus aria-hidden="true" /></button>
                  <span>{quantity}</span>
                  <button type="button" onClick={() => setQuantity((current) => current + 1)} aria-label="Increase quantity"><FiPlus aria-hidden="true" /></button>
                </div>
                <button type="button" className="restaurant-cart-action" onClick={() => handleAddToCart(selectedFood)} disabled={!selectedFood.isAvailable}><FiShoppingCart aria-hidden="true" />{selectedFood.isAvailable ? "Add to cart" : "Unavailable"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

const RestaurantCartPage = ({ navigate, user }) => {
  const { cartItems, removeFromCart, increaseQuantity, decreaseQuantity, cartSummary, clearCart } = useRestaurantCart();

  return (
    <main className="restaurant-cart-page">
      <header className="restaurants-topbar">
        <button type="button" className="restaurants-back" onClick={() => navigate(-1)}><FiArrowLeft aria-hidden="true" /><span>Back</span></button>
        <Link className="restaurants-brand" to="/experience" aria-label="KadaiApp experiences"><span className="restaurants-brand-mark"><FiCoffee /></span><span>Kadai<span>App</span></span></Link>
      </header>

      <section className="restaurant-cart-content">
        <div className="restaurant-cart-header">
          <div>
            <p className="restaurants-eyebrow">Restaurant cart</p>
            <h1>Your order</h1>
          </div>
          {cartItems.length > 0 && <button type="button" className="restaurant-mini-action" onClick={() => clearCart()}>Clear cart</button>}
        </div>

        {cartItems.length === 0 ? (
          <div className="restaurants-state compact-state"><span className="restaurants-empty-icon"><FiShoppingCart aria-hidden="true" /></span><h2>Your restaurant cart is empty</h2><p>Pick a restaurant and add a few favourites to start your order.</p><button type="button" className="restaurants-return-link restaurants-reset-btn" onClick={() => navigate("/restaurants")}>Explore restaurants</button></div>
        ) : (
          <div className="restaurant-cart-layout">
            <div className="restaurant-cart-items">
              {cartItems.map((item) => {
                const itemKey = getRestaurantItemKey(item);
                return (
                  <div className="restaurant-cart-item" key={itemKey}>
                    <div className="restaurant-cart-thumb">{item.image ? <img src={item.image} alt={item.name} /> : <FiCoffee />}</div>
                    <div className="restaurant-cart-meta">
                      <div><strong>{item.name}</strong><p>{item.restaurantName || "Restaurant"}</p></div>
                      <div className="restaurant-cart-price-row">
                        <span>₹{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</span>
                        <div className="restaurant-quantity-picker small-quantity">
                          <button type="button" onClick={() => decreaseQuantity(itemKey)} aria-label="Decrease quantity"><FiMinus aria-hidden="true" /></button>
                          <span>{item.quantity}</span>
                          <button type="button" onClick={() => increaseQuantity(itemKey)} aria-label="Increase quantity"><FiPlus aria-hidden="true" /></button>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="restaurant-remove-btn" onClick={() => removeFromCart(itemKey)}>Remove</button>
                  </div>
                );
              })}
            </div>
            <aside className="restaurant-cart-summary">
              <h2>Order summary</h2>
              <div className="restaurant-summary-row"><span>Subtotal</span><strong>₹{cartSummary.subtotal.toFixed(2)}</strong></div>
              <div className="restaurant-summary-row"><span>Delivery</span><strong>₹{cartSummary.delivery.toFixed(2)}</strong></div>
              <div className="restaurant-summary-row total-row"><span>Total</span><strong>₹{cartSummary.total.toFixed(2)}</strong></div>
              <button type="button" className="restaurant-cart-checkout-btn" onClick={() => navigate("/restaurants/checkout")}>Proceed to checkout</button>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
};

const RestaurantCheckoutPage = ({ navigate, user }) => {
  const { cartItems, cartSummary, clearCart } = useRestaurantCart();
  const { customer } = useAuth();
  const [addressDraft, setAddressDraft] = useState(customer?.address?.fullAddress || customer?.address?.address || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login?redirect=" + encodeURIComponent("/restaurants/checkout"));
    }
  }, [navigate, user]);

  const handlePlaceOrder = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    const trimmedAddress = addressDraft.trim();
    if (!trimmedAddress) {
      setError("Please add a delivery address before placing your order.");
      return;
    }

    if (!cartItems.length) {
      setError("Your restaurant cart is empty.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const orderId = `KADAI-REST-${Date.now().toString().slice(-8)}`;
      const orderRecord = {
        id: orderId,
        restaurantIds: [...new Set(cartItems.map((item) => item.restaurantId || item.shopId || ""))].filter(Boolean),
        restaurantName: cartItems[0]?.restaurantName || "Restaurant",
        customerId: user.uid,
        customerName: customer?.fullName || customer?.name || user.displayName || "Customer",
        customerPhone: user.phoneNumber || customer?.mobile || "",
        address: trimmedAddress,
        items: cartItems,
        subtotal: cartSummary.subtotal,
        delivery: cartSummary.delivery,
        total: cartSummary.total,
        status: "Placed",
        paymentMethod: "Cash on Delivery",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "restaurant_orders"), orderRecord);
      await setDoc(doc(db, "users", user.uid, "restaurant_orders", orderId), orderRecord);
      await clearCart();
      navigate(`/restaurants/track-order/${orderId}`);
    } catch (checkoutError) {
      console.error("[RESTAURANT CHECKOUT] Error:", checkoutError);
      setError(checkoutError?.message || "Order placement failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="restaurant-cart-page">
      <header className="restaurants-topbar">
        <button type="button" className="restaurants-back" onClick={() => navigate(-1)}><FiArrowLeft aria-hidden="true" /><span>Back</span></button>
        <Link className="restaurants-brand" to="/experience" aria-label="KadaiApp experiences"><span className="restaurants-brand-mark"><FiCoffee /></span><span>Kadai<span>App</span></span></Link>
      </header>
      <section className="restaurant-checkout-shell">
        <div className="restaurant-checkout-box">
          <p className="restaurants-eyebrow">Checkout</p>
          <h1>Complete your restaurant order</h1>
          <label className="restaurant-checkout-field"><span>Delivery address</span><textarea value={addressDraft} onChange={(event) => setAddressDraft(event.target.value)} rows={4} placeholder="Enter your delivery address" /></label>
          <div className="restaurant-checkout-summary">
            <div className="restaurant-summary-row"><span>Items</span><strong>{cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</strong></div>
            <div className="restaurant-summary-row"><span>Subtotal</span><strong>₹{cartSummary.subtotal.toFixed(2)}</strong></div>
            <div className="restaurant-summary-row"><span>Delivery</span><strong>₹{cartSummary.delivery.toFixed(2)}</strong></div>
            <div className="restaurant-summary-row total-row"><span>Total</span><strong>₹{cartSummary.total.toFixed(2)}</strong></div>
          </div>
          {error && <p className="restaurant-error-banner">{error}</p>}
          <button type="button" className="restaurant-cart-checkout-btn" disabled={saving} onClick={handlePlaceOrder}>{saving ? "Placing order..." : "Place order"}</button>
        </div>
      </section>
    </main>
  );
};

const RestaurantOrdersPage = ({ navigate, user }) => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(db) && Boolean(user));

  useEffect(() => {
    if (!db || !user?.uid) {
      setIsLoading(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, "users", user.uid, "restaurant_orders"), orderBy("createdAt", "desc")),
      (snapshot) => {
        setOrders(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
        setIsLoading(false);
      },
      (error) => {
        console.error("[RESTAURANT ORDERS] Load failed:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  return (
    <main className="restaurant-cart-page">
      <header className="restaurants-topbar">
        <button type="button" className="restaurants-back" onClick={() => navigate(-1)}><FiArrowLeft aria-hidden="true" /><span>Back</span></button>
        <Link className="restaurants-brand" to="/experience" aria-label="KadaiApp experiences"><span className="restaurants-brand-mark"><FiCoffee /></span><span>Kadai<span>App</span></span></Link>
      </header>
      <section className="restaurant-orders-shell">
        <div className="restaurant-cart-header">
          <div><p className="restaurants-eyebrow">Order history</p><h1>Restaurant orders</h1></div>
          <button type="button" className="restaurant-mini-action" onClick={() => navigate("/restaurants")}>Browse menu</button>
        </div>
        {isLoading ? (
          <div className="restaurants-state compact-state"><div className="restaurants-spinner" aria-live="polite" /><p>Loading order history...</p></div>
        ) : orders.length ? (
          <div className="restaurant-order-list">
            {orders.map((order) => (
              <button type="button" key={order.id} className="restaurant-order-card" onClick={() => navigate(`/restaurants/track-order/${order.id}`)}>
                <div className="restaurant-order-topline"><strong>{order.restaurantName || "Restaurant"}</strong><span>{order.status || "Placed"}</span></div>
                <p>{order.items?.length || 0} items</p>
                <div className="restaurant-order-bottomline"><span>₹{Number(order.total || 0).toFixed(2)}</span><span>{order.id}</span></div>
              </button>
            ))}
          </div>
        ) : (
          <div className="restaurants-state compact-state"><span className="restaurants-empty-icon"><FiPackage aria-hidden="true" /></span><h2>No restaurant orders yet</h2><p>Your restaurant orders will appear here after checkout.</p><button type="button" className="restaurants-return-link restaurants-reset-btn" onClick={() => navigate("/restaurants")}>Explore restaurants</button></div>
        )}
      </section>
    </main>
  );
};

const RestaurantTrackOrderPage = ({ navigate, user }) => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return undefined;
    }

    const fetchOrder = async () => {
      try {
        if (!db) {
          setLoading(false);
          return;
        }

        const orderRef = doc(db, "restaurant_orders", orderId);
        const snapshot = await getDoc(orderRef);
        if (snapshot.exists()) {
          setOrder({ id: snapshot.id, ...snapshot.data() });
        } else if (user?.uid) {
          const userSnapshot = await getDoc(doc(db, "users", user.uid, "restaurant_orders", orderId));
          if (userSnapshot.exists()) setOrder({ id: userSnapshot.id, ...userSnapshot.data() });
        }
      } catch (error) {
        console.error("[RESTAURANT ORDER TRACK] Load failed:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
    return undefined;
  }, [orderId, user?.uid]);

  const statusSteps = ["Placed", "Preparing", "Out for delivery", "Delivered"];
  const currentIndex = Math.max(0, statusSteps.indexOf(order?.status || "Placed"));

  return (
    <main className="restaurant-cart-page">
      <header className="restaurants-topbar">
        <button type="button" className="restaurants-back" onClick={() => navigate(-1)}><FiArrowLeft aria-hidden="true" /><span>Back</span></button>
        <Link className="restaurants-brand" to="/experience" aria-label="KadaiApp experiences"><span className="restaurants-brand-mark"><FiCoffee /></span><span>Kadai<span>App</span></span></Link>
      </header>
      <section className="restaurant-checkout-shell">
        {loading ? (
          <div className="restaurants-state compact-state"><div className="restaurants-spinner" aria-live="polite" /><p>Loading order details...</p></div>
        ) : order ? (
          <div className="restaurant-order-track-box">
            <p className="restaurants-eyebrow">Tracking</p>
            <h1>{order.restaurantName || "Restaurant order"}</h1>
            <div className="restaurant-order-badge">{order.status || "Placed"}</div>
            <div className="restaurant-track-steps">
              {statusSteps.map((step, index) => (
                <div key={step} className={index <= currentIndex ? "track-step active" : "track-step"}><span>{index + 1}</span><strong>{step}</strong></div>
              ))}
            </div>
            <div className="restaurant-order-meta-grid">
              <div><span>Order ID</span><strong>{order.id}</strong></div>
              <div><span>Total</span><strong>₹{Number(order.total || 0).toFixed(2)}</strong></div>
              <div><span>Address</span><strong>{order.address || "Delivery address"}</strong></div>
            </div>
            <button type="button" className="restaurant-cart-checkout-btn" onClick={() => navigate("/restaurants/orders")}>View all orders</button>
          </div>
        ) : (
          <div className="restaurants-state compact-state"><span className="restaurants-empty-icon"><FiPackage aria-hidden="true" /></span><h2>Order not found</h2><p>This restaurant order could not be found.</p><button type="button" className="restaurants-return-link restaurants-reset-btn" onClick={() => navigate("/restaurants/orders")}>Order history</button></div>
        )}
      </section>
    </main>
  );
};

export default Restaurants;

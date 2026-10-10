                                                                                                                                                                                                 import { useMemo, useState, useEffect } from "react";
import {
  FiSearch,
  FiShoppingCart,
  FiUser,
  FiMenu,
  FiX,
  FiChevronDown,
} from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import "../index.css";
import { useCart } from "./CardContext";
import { useLocation } from "./LocationContext";
import AddressChangeModal from "./AddressChangeModal";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { useAuth } from "./AuthContext";

import { getMarketplaceCatalog } from "../services/marketplace.service";
import { subscribeCategoryNames } from "../services/category.service";

const formatRegisteredAddress = (address) => {
  if (!address) {
    return "";
  }

  if (address.fullAddress) {
    return address.fullAddress;
  }

  if (address.address) {
    return address.address;
  }

  return [
    address.area,
    address.city,
    address.district,
    address.state,
    address.country,
    address.pincode,
  ]
    .filter(Boolean)
    .join(", ");
};

const Navbar = () => {
  const navigate = useNavigate();
  const { cartCount } = useCart();
  const { user, customer, loading: isProfileAddressLoading } = useAuth();
  const {
    location,
    status: locationStatus,
    error: locationError,
    requestLocation,
  } = useLocation();

  const isAuthenticated = Boolean(user);
  const userName = customer?.fullName || customer?.name || user?.displayName || "";

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const currentProfileAddress = formatRegisteredAddress(customer?.address);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Categories
  const [showCategories, setShowCategories] = useState(false);
  const [categoryNames, setCategoryNames] = useState([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(false);

  // Close mobile menu when navigating
  useEffect(() => {
    const handleNavigation = () => {
      setIsMobileMenuOpen(false);
      setShowSearch(false);
    };

    window.addEventListener("navigate", handleNavigation);
    return () => window.removeEventListener("navigate", handleNavigation);
  }, []);

  const handleLogout = async () => {
    setShowProfile(false);
    try {
      if (auth) await signOut(auth);
    } catch (error) {
      console.error("[AUTH] Logout failed:", error);
    }
  };

  const liveProducts = getMarketplaceCatalog();

  useEffect(() => {
    const unsubscribe = subscribeCategoryNames({
      onNames: (names) => {
        setCategoryNames(names);
        setIsCategoriesLoading(false);
        setCategoriesError(false);
      },
      onError: () => {
        setIsCategoriesLoading(false);
        setCategoriesError(true);
      },
    });

    return () => unsubscribe();
  }, []);

  const categoryItems = useMemo(() => {
    return categoryNames.map((category) => {
      const categoryProduct = liveProducts.find(
        (product) =>
          product.category?.toLowerCase() ===
          category.toLowerCase()
      );

      return {
        name: category,
        image: categoryProduct?.image || null,
      };
    });
  }, [categoryNames, liveProducts]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return [];
    }

    const liveProducts = getMarketplaceCatalog();

    return liveProducts.filter((product) => {
      const itemNo = String(product.itemNo || "").toLowerCase();
      return (
        product.name?.toLowerCase().includes(query) ||
        itemNo.includes(query) ||
        product.category?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
      );
    });
  }, [searchQuery]);

  const handleSearchProductClick = (id) => {
    setSearchQuery("");
    setShowSearch(false);

    navigate(`/product/${id}`);
  };

  const handleCategoryClick = (category) => {
    setShowCategories(false);

    navigate(
      `/products?market=global&category=${encodeURIComponent(category)}`
    );
  };

  const openAddressEditor = () => {
    setShowProfile(false);
    setShowAddressModal(true);
  };

  return (
    <>
      <nav className="navbar">
        <div
          className="logo"
          onClick={() => navigate("/")}
        >
          <span>Kadai</span>App
        </div>
        <div className="desktop-menu">

          <a href="/">Home</a>


          {/* Categories */}

          <div className="navbar-category-wrapper">

            <button
              type="button"
              className="menu-dropdown category-menu-btn"
              onClick={() =>
                setShowCategories(!showCategories)
              }
            >
              Categories

              <FiChevronDown
                size={13}
                className={
                  showCategories
                    ? "category-arrow active"
                    : "category-arrow"
                }
              />
            </button>

            {showCategories && (
              <div className="navbar-category-dropdown">

                {isCategoriesLoading ? (
                  <div>Loading categories...</div>
                ) : categoriesError ? (
                  <div>Unable to load categories</div>
                ) : categoryItems.map((category) => (

                  <button
                    key={category.name}
                    type="button"
                    className="category-dropdown-item"
                    onClick={() =>
                      handleCategoryClick(
                        category.name
                      )
                    }
                  >

                    <div className="category-dropdown-image">

                      {category.image ? (

                        <img
                          src={category.image}
                          alt={category.name}
                        />

                      ) : (

                        <div className="category-image-placeholder">
                          <FiShoppingCart />
                        </div>

                      )}

                    </div>


                    {/* Category Name */}

                    <span>
                      {category.name}
                    </span>

                  </button>

                ))}

              </div>
            )}

          </div>


          {/* Products */}

          <button
            type="button"
            className="menu-dropdown navbar-product-btn"
            onClick={() => {
              setShowCategories(false);
              navigate("/products");
            }}
          >
            Products
          </button>


          {/* Orders */}

          <Link to="/orders" className="menu-dropdown">
            Orders
          </Link>

        </div>

        <div className="desktop-search-wrapper">

          <div className="desktop-search">

            <FiSearch />

            <input
              type="text"
              placeholder="Search....."
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
            />


            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() =>
                  setSearchQuery("")
                }
              >
                <FiX size={15} />
              </button>
            )}

          </div>

          {searchQuery.trim() && (

            <div className="search-results-dropdown">

              {searchResults.length > 0 ? (

                <>

                  <div className="search-result-title">
                    Search Results
                  </div>


                  {searchResults.slice(0, 6).map(
                    (product) => (

                      <button
                        type="button"
                        className="search-result-item"
                        key={product.id}
                        onClick={() =>
                          handleSearchProductClick(
                            product.id
                          )
                        }
                      >

                        <img
                          src={product.image}
                          alt={product.name}
                        />


                        <div className="search-result-info">

                          <strong>
                            {product.name}
                          </strong>

                          <span>
                            {product.category}
                          </span>

                        </div>


                        <div className="search-result-price">
                          ₹{product.price.toFixed(2)}
                        </div>

                      </button>

                    )
                  )}

                </>

              ) : (

                <div className="product-not-found">

                  <FiSearch size={22} />

                  <strong>
                    Product Not Found
                  </strong>

                  <span>
                    No product matches "{searchQuery}"
                  </span>

                </div>

              )}

            </div>

          )}

        </div>

        <div className="nav-actions">

          <button
            className="icon-btn mobile-search-btn"
            onClick={() =>
              setShowSearch(!showSearch)
            }
            aria-label="Search"
          >
            <FiSearch />
          </button>


          {/* Cart */}

          <button
            onClick={() =>
              navigate("/cart")
            }
            className="icon-btn cart-btn"
            aria-label="Shopping Cart"
          >

            <FiShoppingCart />

            <span className="badge">
              {cartCount}
            </span>

          </button>


          {/* Login / User */}

          {!isAuthenticated ? (

            <button
              className="login-btn"
              onClick={() =>
                navigate("/login")
              }
            >
              Login
            </button>

          ) : (

            <div className="profile-wrapper">

              <button
                className="user-btn"
                onClick={() =>
                  setShowProfile(!showProfile)
                }
                aria-label="User Profile"
              >
                <FiUser />
              </button>


              {showProfile && (

                <div className="profile-dropdown">

                  <div className="profile-title">

                    <div className="profile-avatar">
                      <FiUser />
                    </div>

                    <div>

                      <strong>
                        {userName}
                      </strong>

                      <small>
                        Welcome back!
                      </small>

                    </div>

                  </div>


                  <button
                    type="button"
                    onClick={() => {
                      setShowProfile(false);
                      navigate("/profile");
                    }}
                  >
                    My Profile
                  </button>

                  <div
                    className="profile-address"
                    onClick={openAddressEditor}
                    style={{ cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <strong>Address</strong>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openAddressEditor();
                        }}
                      >
                      </button>
                    </div>

                    {currentProfileAddress && <span>{currentProfileAddress}</span>}

                    {!currentProfileAddress && !isProfileAddressLoading && locationStatus === "loading" && (
                      <span>Detecting your current location...</span>
                    )}

                    {!currentProfileAddress && !isProfileAddressLoading && locationStatus === "success" && location && (
                      <span>{location.address}</span>
                    )}

                    {!currentProfileAddress && !isProfileAddressLoading && locationStatus === "error" && (
                      <>
                        <span>{locationError}</span>
                        <button
                          type="button"
                          className="location-retry-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            requestLocation();
                          }}
                        >
                          Try Again
                        </button>
                      </>
                    )}
                  </div>


                  <button
                    type="button"
                    onClick={() => {
                      setShowProfile(false);
                      navigate("/orders");
                    }}
                  >
                    My Orders
                  </button>

                  <button
                    className="logout-btn"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>

                </div>

              )}

            </div>

          )}


          {/* Mobile Menu Toggle */}

          <button
            className="mobile-menu-toggle"
            onClick={() =>
              setIsMobileMenuOpen(!isMobileMenuOpen)
            }
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >

            {isMobileMenuOpen ? (
              <FiX size={24} />
            ) : (
              <FiMenu size={24} />
            )}

          </button>

        </div>

      </nav>

      <AddressChangeModal
        open={showAddressModal}
        onClose={() => setShowAddressModal(false)}
      />

      {showSearch && (

        <div className="mobile-search-panel">

          <div className="mobile-search-container">

            <div className="mobile-search-box">

              <FiSearch />

              <input
                autoFocus
                type="text"
                placeholder="Search....."
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
              />


              {searchQuery && (

                <button
                  type="button"
                  className="mobile-search-clear"
                  onClick={() =>
                    setSearchQuery("")
                  }
                  aria-label="Clear search"
                >
                  <FiX />
                </button>

              )}


              <button
                type="button"
                className="mobile-search-close"
                onClick={() => {
                  setSearchQuery("");
                  setShowSearch(false);
                }}
                aria-label="Close search"
              >
                <FiX />
              </button>

            </div>

            {searchQuery.trim() && (

              <div className="mobile-search-results">

                {searchResults.length > 0 ? (

                  <>

                    <div className="search-result-title">
                      Search Results
                    </div>


                    {searchResults.slice(0, 6).map(
                      (product) => (

                        <button
                          type="button"
                          className="search-result-item"
                          key={product.id}
                          onClick={() =>
                            handleSearchProductClick(
                              product.id
                            )
                          }
                        >

                          <img
                            src={product.image}
                            alt={product.name}
                          />


                          <div className="search-result-info">

                            <strong>
                              {product.name}
                            </strong>

                            <span>
                              {product.category}
                            </span>

                          </div>


                          <div className="search-result-price">
                            ₹{product.price.toFixed(2)}
                          </div>

                        </button>

                      )
                    )}

                  </>

                ) : (

                  <div className="product-not-found">

                    <FiSearch size={22} />

                    <strong>
                      Product Not Found
                    </strong>

                    <span>
                      No product matches "{searchQuery}"
                    </span>

                  </div>

                )}

              </div>

            )}

          </div>

        </div>

      )}

      {/* Mobile Navigation Menu */}

      {isMobileMenuOpen && (

        <div className="mobile-nav-drawer">

          <nav className="mobile-nav-links">

            <Link 
              to="/" 
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Home
            </Link>

            <Link 
              to="/products" 
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Products
            </Link>

            <Link
              to="/orders"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Orders
            </Link>


            {!isAuthenticated && (

              <button
                className="mobile-nav-login"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigate("/login");
                }}
              >
                Login
              </button>

            )}

          </nav>

        </div>

      )}

    </>
  );
};

export default Navbar;
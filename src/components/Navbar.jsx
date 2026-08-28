import React, { useMemo, useState } from "react";
import {
  FiSearch,
  FiShoppingCart,
  FiHeart,
  FiUser,
  FiMenu,
  FiX,
  FiChevronDown,
} from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import "../index.css";
import { useCart } from "./CardContext";

import { products } from "../data/category";

const categories = [
  "Fruits",
  "Vegetables",
  "Dairy",
  "Bakery",
  "Groceries",
  "Drinks",
  "Snacks",
  "Household",
  "Personal Care",
];

const Navbar = () => {
  const navigate = useNavigate();
  const { cartCount } = useCart();

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("isLoggedIn") === "true";
  });

  const [userName, setUserName] = useState(() => {
    const savedUser = localStorage.getItem("registeredUser");

    if (savedUser) {
      const user = JSON.parse(savedUser);
      return user.fullName || "";
    }

    return "";
  });

  const [showMenu, setShowMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Categories
  const [showCategories, setShowCategories] = useState(false);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setShowProfile(false);
    localStorage.removeItem("isLoggedIn");
  };

  // =========================================
  // CATEGORY IMAGES
  // First product image from each category
  // =========================================

  const categoryItems = useMemo(() => {
    return categories.map((category) => {
      const categoryProduct = products.find(
        (product) =>
          product.category?.toLowerCase() ===
          category.toLowerCase()
      );

      return {
        name: category,
        image: categoryProduct?.image || null,
      };
    });
  }, []);

  // =========================================
  // LIVE SEARCH
  // =========================================

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return products.filter((product) => {
      return (
        product.name?.toLowerCase().includes(query) ||
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
      `/products?category=${encodeURIComponent(category)}`
    );
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

                {categoryItems.map((category) => (

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


          {/* Offers */}

          <Link to="/offers">
            Offers
          </Link>


          {/* Orders */}

          <a
            href="#orders"
            className="menu-dropdown"
          >
            Orders
          </a>

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
          >
            <FiSearch />
          </button>


          {/* Wishlist */}

          <button className="icon-btn wishlist-btn">

            <FiHeart />

            <span className="badge">
              0
            </span>

          </button>


          {/* Cart */}

          <button
            onClick={() =>
              navigate("/cart")
            }
            className="icon-btn cart-btn"
          >

            <FiShoppingCart />

            <span className="badge">
              {cartCount}
            </span>

          </button>


          {/* Login / User */}

          {!isLoggedIn ? (

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


                  <button>
                    My Profile
                  </button>


                  <button>
                    My Orders
                  </button>


                  <button>
                    Saved Items
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


          {/* Mobile Menu */}

          <button
            className="menu-btn"
            onClick={() =>
              setShowMenu(!showMenu)
            }
          >

            {showMenu ? (
              <FiX />
            ) : (
              <FiMenu />
            )}

          </button>

        </div>

      </nav>

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

      {showMenu && (

        <div className="mobile-menu">

          <Link to={"/"}>
            Home
          </Link>

          <Link to={"/products"}>
            Products
          </Link>

          <Link to={"/offers"}>
            Offers
          </Link>

          <a href="orders">
            Orders
          </a>


          {!isLoggedIn && (

            <button
              className="mobile-login"
              onClick={() =>
                navigate("/login")
              }
            >
              Login
            </button>

          )}

        </div>

      )}

    </>
  );
};

export default Navbar;
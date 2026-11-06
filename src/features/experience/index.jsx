import { signOut } from "firebase/auth";
import { FiArrowUpRight, FiLogOut, FiShoppingBag, FiCoffee } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../../services/firebase";
import shopsImage from "../../assets/items.png";
import bakery from "../../assets/bakery.png";
import "./experience.css";

const Experience = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      if (auth) await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("[AUTH] Logout failed:", error);
    }
  };

  return (
    <main className="experience-page">
      <header className="experience-topbar">
        <Link className="experience-brand" to="/" aria-label="KadaiApp home">
          <span className="experience-brand-mark"><FiShoppingBag /></span>
          <span>Kadai<span>App</span></span>
        </Link>
        <button className="experience-logout" type="button" onClick={handleLogout}>
          <FiLogOut aria-hidden="true" />
          <span>Log out</span>
        </button>
      </header>

      <section className="experience-content" aria-labelledby="experience-title">
        <div className="experience-intro">
          <p className="experience-welcome">Welcome to KadaiApp</p>
          <h1 id="experience-title">Choose Your Experience</h1>
          <p className="experience-subtitle">
            Shop your daily needs from local &amp; global stores or explore restaurants and food.
          </p>
        </div>

        <div className="experience-options">
          <Link className="experience-card experience-card-shops" to="/products?market=local">
            <div className="experience-card-copy">
              <span className="experience-card-icon"><FiShoppingBag aria-hidden="true" /></span>
              <span className="experience-eyebrow">SHOP YOUR WAY</span>
              <h2>Local &amp; Global Shops</h2>
              <p>Discover nearby stores and explore products from anywhere.</p>
              <span className="experience-card-action">
                Explore Shops <FiArrowUpRight aria-hidden="true" />
              </span>
            </div>
            <div className="experience-card-art">
              <img src={bakery} alt="A selection of fresh groceries" />
            </div>
          </Link>

          <Link className="experience-card experience-card-restaurants" to="/restaurants">
            <div className="experience-card-copy">
              <span className="experience-card-icon"><FiCoffee aria-hidden="true" /></span>
              <span className="experience-eyebrow">GOOD FOOD, CLOSE BY</span>
              <h2>Restaurants</h2>
              <p>Discover restaurants near you and explore delicious food.</p>
              <span className="experience-card-action">
                Explore Restaurants <FiArrowUpRight aria-hidden="true" />
              </span>
            </div>
            <div className="experience-card-art">
              <img src={bakery} alt="Freshly baked pastries and desserts" />
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
};

export default Experience;

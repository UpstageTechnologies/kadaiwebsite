import { signOut } from "firebase/auth";
import { FiArrowUpRight, FiLogOut, FiShoppingBag } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../../services/firebase";
import shopsImage from "../../assets/shops.jpeg";
import restaurantsImage from "../../assets/restaurants.jpeg";
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
            <img className="experience-card-background" src={shopsImage} alt="" aria-hidden="true" />
            <div className="experience-card-copy">
              <span className="experience-eyebrow">SHOPPING</span>
              <h2>Local &amp; Global Shops</h2>
              <p>Discover nearby stores and explore products from anywhere.</p>
              <span className="experience-card-action">
                Explore Shops <FiArrowUpRight aria-hidden="true" />
              </span>
            </div>
          </Link>

          <Link className="experience-card experience-card-restaurants" to="/restaurants">
            <img className="experience-card-background" src={restaurantsImage} alt="" aria-hidden="true" />
            <div className="experience-card-copy">
              <span className="experience-eyebrow">FOOD &amp; DINING</span>
              <h2>Restaurants</h2>
              <p>Discover restaurants near you and explore delicious food.</p>
              <span className="experience-card-action">
                Explore Restaurants <FiArrowUpRight aria-hidden="true" />
              </span>
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
};

export default Experience;

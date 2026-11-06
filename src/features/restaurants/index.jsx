import { FiArrowLeft, FiCoffee } from "react-icons/fi";
import { Link } from "react-router-dom";
import "./restaurants.css";

const Restaurants = () => (
  <main className="restaurants-page">
    <header className="restaurants-topbar">
      <Link className="restaurants-back" to="/experience">
        <FiArrowLeft aria-hidden="true" />
        <span>Back to experiences</span>
      </Link>
      <Link className="restaurants-brand" to="/experience" aria-label="KadaiApp experiences">
        <span className="restaurants-brand-mark"><FiCoffee /></span>
        <span>Kadai<span>App</span></span>
      </Link>
    </header>
     <section className="restaurants-content" aria-labelledby="restaurants-title">
      <p className="restaurants-eyebrow">A LITTLE SOMETHING DELICIOUS</p>
      <h1 id="restaurants-title">Explore Restaurants</h1>
      <p className="restaurants-description">
        Find a new favourite and enjoy good food from places around you.
      </p>

      <div className="restaurants-empty-state">
        <span className="restaurants-empty-icon"><FiCoffee aria-hidden="true" /></span>
        <h2>Restaurants coming soon</h2>
        <p>We’re getting local restaurants ready for you. Check back soon!</p>
        <Link to="/experience" className="restaurants-return-link">
          <FiArrowLeft aria-hidden="true" />
          Back to experiences
        </Link>
      </div>
    </section>
  </main>
  );
export default Restaurants;

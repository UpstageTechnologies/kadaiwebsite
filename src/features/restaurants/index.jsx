import { FiArrowLeft, FiCoffee } from "react-icons/fi";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar";
import "./restaurants.css";

const Restaurants = () => (
  <>
    <Navbar />
    <main className="restaurants-page">
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
  </>
);

export default Restaurants;

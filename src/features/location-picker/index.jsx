import { useNavigate } from "react-router-dom";
import { FiMapPin, FiArrowLeft } from "react-icons/fi";
import "./location-picker.css";

const LocationPicker = () => {
  const navigate = useNavigate();

  return (
    <main className="location-picker-page">
      <section className="location-picker-shell">
        <button type="button" className="location-picker-back" onClick={() => navigate("/")}>
          <FiArrowLeft />
          Back to Home
        </button>

        <div className="location-picker-card">
          <div className="location-picker-icon">
            <FiMapPin size={44} />
          </div>
          <span className="location-picker-kicker">Location required</span>
          <h1>Choose your delivery location</h1>
          <p>
            We need your delivery address before we can continue to your customer home.
          </p>

          <button type="button" className="location-picker-button" onClick={() => navigate("/")}>
            Continue to customer home
          </button>
        </div>
      </section>
    </main>
  );
};

export default LocationPicker;

import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiPhone, FiArrowLeft } from "react-icons/fi";

import {
  firebaseFindCustomerByMobile,
} from "../../../services/firebase";

import "./login.css";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const validateAndShow = () => {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) {
      setError("Please enter your Indian phone number.");
      return false;
    }

    if (digits.length !== 10) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return false;
    }

    return true;
  };

  const requestLocationAfterLogin = () => {
    console.log("[LOCATION] Requesting location");

    if (!navigator.geolocation) {
      console.log("[LOCATION] Geolocation is unsupported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const coordinates = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        try {
          console.log("[LOCATION] Location received", coordinates);
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coordinates.latitude}&lon=${coordinates.longitude}`,
            { headers: { Accept: "application/json" } }
          );

          if (!response.ok) {
            throw new Error("Unable to resolve the browser location into an address.");
          }

          const data = await response.json();
          const detectedLocation = {
            ...coordinates,
            address: data.display_name || `${coordinates.latitude}, ${coordinates.longitude}`,
            detectedAt: new Date().toISOString(),
          };

          localStorage.setItem("currentLocation", JSON.stringify(detectedLocation));
        } catch (locationMapError) {
          console.warn("[LOCATION] Reverse geocode fallback:", locationMapError);
          localStorage.setItem(
            "currentLocation",
            JSON.stringify({
              latitude: coordinates.latitude,
              longitude: coordinates.longitude,
              address: `${coordinates.latitude}, ${coordinates.longitude}`,
              detectedAt: new Date().toISOString(),
            })
          );
        }
      },
      (permissionError) => {
        console.warn("[LOCATION] Location permission denied or unavailable:", permissionError?.message || permissionError);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
    );
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!validateAndShow()) {
      return;
    }

    setLoading(true);

    try {
      console.log("[AUTH] Login started");
      const normalizedPhone = `+91${String(phone || "").replace(/\D/g, "")}`;
      const customer = await firebaseFindCustomerByMobile(normalizedPhone);

      if (!customer) {
        setError("Invalid phone number. This phone number is not registered.");
        return;
      }

      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("registrationInProgress", "false");
      localStorage.setItem("registeredUser", JSON.stringify(customer));

      setSuccess("Login successful!");
      console.log("[AUTH] Login successful");

      requestLocationAfterLogin();

      const redirectPath = new URLSearchParams(location.search).get("redirect") || "/";
      navigate(redirectPath || "/", { replace: true });
    } catch (loginError) {
      const message = loginError?.message || "Login failed. Please try again.";
      setError(message);
      console.error("[AUTH] Login error:", loginError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <button type="button" className="login-back-btn" onClick={() => navigate("/")}>
        <FiArrowLeft />
        Back to Home
      </button>

      <div className="login-container">
        <section className="login-info">
          <div className="login-brand">
            <span>Kadai</span>App
          </div>

          <h1>
            Welcome
            <br />
            Back!
          </h1>

          <p>Login to continue shopping and manage your orders easily.</p>

          <div className="login-benefits">
            <div>
              <span>✓</span>
              Easy and secure shopping
            </div>
            <div>
              <span>✓</span>
              Track your orders
            </div>
            <div>
              <span>✓</span>
              Save your favorite products
            </div>
          </div>
        </section>

        <section className="login-card">
          <div className="login-heading">
            <h2>Login</h2>
            <p>Enter your details to continue</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="login-field">
              <label htmlFor="phone">Phone Number</label>

              <div className="input-wrapper">
                <FiPhone />
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                  placeholder="Enter 10-digit phone number"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                />
              </div>
            </div>

            {error && <div className="login-message error">{error}</div>}
            {success && <div className="login-message success">{success}</div>}

            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <div className="register-text">
            <p>
              Don't have an account?{" "}
              <button type="button" onClick={() => navigate("/register")}>
                Create Account
              </button>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Login;

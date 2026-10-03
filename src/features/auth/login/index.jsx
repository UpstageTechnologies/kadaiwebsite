                                                                                                                                                                import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiPhone, FiArrowLeft } from "react-icons/fi";
                                                                                                                                                                import { signOut } from "firebase/auth";
import {
                                                                                                                                                                  auth,
                                                                                                                                                                  firebaseCreatePhoneVerifier,
                                                                                                                                                                  firebaseSendPhoneOtp,
                                                                                                                                                                  firebaseClearPhoneVerifier,
                                                                                                                                                                  firebaseCustomerSnapshot,
                                                                                                                                                                  firebaseIsPhoneOtpInProgress,
                                                                                                                                                                  firebaseSetPhoneOtpInProgress,
                                                                                                                                                                  normalizePhoneOtpError,
} from "../../../services/firebase";

import "./login.css";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [isRecaptchaVisible, setIsRecaptchaVisible] = useState(false);

  useEffect(() => {
    if (confirmation || !isRecaptchaVisible) return undefined;

    let active = true;
    firebaseCreatePhoneVerifier().catch((verifierError) => {
      if (active) {
        setError(normalizePhoneOtpError(verifierError) || verifierError?.message || "Unable to initialize device verification.");
        setIsRecaptchaVisible(false);
      }
    });

    return () => {
      active = false;
      firebaseClearPhoneVerifier();
    };
  }, [confirmation, isRecaptchaVisible]);

const validateAndShow = () => {
  const digits = String(phone || "").replace(/\D/g, "");

  console.log("[LOGIN] Raw phone:", phone);
  console.log("[LOGIN] Normalized digits:", digits);
  console.log("[LOGIN] Digit length:", digits.length);

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

    if (!confirmation && !isRecaptchaVisible) {
      setError("");
      setIsRecaptchaVisible(true);
      return;
    }

    setLoading(true);

    try {
      if (!confirmation) {
        if (!auth) throw new Error("Firebase auth is not configured.");
        if (firebaseIsPhoneOtpInProgress()) return;

        const verifier = await firebaseCreatePhoneVerifier();
        const result = await firebaseSendPhoneOtp(`+91${phone}`, verifier);
        setConfirmation(result);
        setSuccess("Verification code sent.");
        return;
      }

      if (!/^\d{6}$/.test(otp.trim())) {
        setError("Enter the 6-digit OTP.");
        return;
      }

      await confirmation.confirm(otp.trim());
      const authenticatedUser = auth?.currentUser;
      if (!authenticatedUser?.uid) {
        throw new Error("Firebase could not establish your login session. Please try again.");
      }

      const customerSnapshot = await firebaseCustomerSnapshot(authenticatedUser.uid);
      if (!customerSnapshot.exists()) {
        await signOut(auth);
        setConfirmation(null);
        setOtp("");
        setError("This phone number is not registered. Please create an account first.");
        return;
      }

      setSuccess("Login successful!");
      requestLocationAfterLogin();

      const redirectPath = new URLSearchParams(location.search).get("redirect") || "/";
      navigate(redirectPath || "/", { replace: true });
    } catch (loginError) {
      const code = loginError?.code || "";
      const message = code.startsWith("auth/")
        ? normalizePhoneOtpError(loginError) || loginError.message
        : loginError?.message || "Login failed. Please try again.";
      setError(message);
      console.error("[AUTH] Login error:", loginError);
      if (!confirmation) setIsRecaptchaVisible(false);
      if (confirmation) {
        setOtp("");
      }
    } finally {
      setLoading(false);
      firebaseSetPhoneOtpInProgress(false);
    }
  };

  const resetOtp = () => {
    setConfirmation(null);
    setIsRecaptchaVisible(false);
    setOtp("");
    setError("");
    setSuccess("");
    firebaseClearPhoneVerifier();
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

              {confirmation ? (
                <div className="input-wrapper">
                  <FiPhone />
                  <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </div>
              ) : (
                <div className="input-wrapper">
                  <FiPhone />
                  <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    placeholder="Enter 10-digit phone number"
                    value={phone}
                    onChange={(event) => {
                      const nextPhone = event.target.value.replace(/\D/g, "").slice(0, 10);
                      setPhone(nextPhone);
                      setIsRecaptchaVisible(nextPhone.length === 10);
                    }}
                  />
                </div>
              )}
            </div>

            {!confirmation && isRecaptchaVisible && (
              <div id="recaptcha-container" className="login-recaptcha" />
            )}

            {error && <div className="login-message error">{error}</div>}
            {success && <div className="login-message success">{success}</div>}

            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? "Signing in..." : confirmation ? "Verify & Login" : "Login"}
            </button>
            {confirmation && (
              <button type="button" className="register-text" onClick={resetOtp}>
                Change phone number
              </button>
            )}
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
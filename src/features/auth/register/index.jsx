import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiPhone, FiArrowLeft, FiUser } from "react-icons/fi";
import {
  auth,
  firebaseCreatePhoneVerifier,
  firebaseSendPhoneOtp,
  firebaseClearPhoneVerifier,
  firebaseIsPhoneOtpInProgress,
  firebaseSetPhoneOtpInProgress,
  normalizePhoneOtpError,
  firebaseUpsertCustomerProfile,
  updateProfile,
} from "../../../services/firebase";
import {
  setConfirmation,
  getConfirmation,
  clearConfirmation,
  getRegistrationPhone,
  clearRegistrationPhone,
  setRegistrationUsername,
  getRegistrationUsername,
  clearRegistrationUsername,
} from "./phoneSession";
import {
  getRegistrationCountries,
  getRegistrationLocationOptions,
} from "../../../services/registration-location.service";
import "./register.css";

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialPhone = location.state?.phone || getRegistrationPhone();
  const routeStep = useMemo(() => {
    if (location.pathname === "/register/otp") return "otp";
    if (location.pathname === "/register/username") return "username";
    if (location.pathname === "/register/address") return "address";
    return "phone";
  }, [location.pathname]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneCode, setPhoneCode] = useState("+91");
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState("");
  const [seconds, setSeconds] = useState(30);
  const [username, setUsername] = useState(getRegistrationUsername());
  const [countryId, setCountryId] = useState("");
  const [countryOptions, setCountryOptions] = useState([]);
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [locationMode, setLocationMode] = useState("manual");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [locationOptions, setLocationOptions] = useState({
    states: [],
    districts: [],
    cities: [],
    areas: [],
  });
  const [locationLoading, setLocationLoading] = useState({
    countries: false,
    states: false,
    districts: false,
    cities: false,
    areas: false,
  });
  const locationRequestIds = useRef({
    countries: 0,
    states: 0,
    districts: 0,
    cities: 0,
    areas: 0,
  });

  useEffect(() => {
    if (routeStep === "otp" && !getConfirmation()) {
      navigate("/register", { replace: true });
    }

    if (routeStep === "username" && !auth?.currentUser) {
      navigate("/register", { replace: true });
    }

    if (routeStep === "address" && !auth?.currentUser) {
      navigate("/register", { replace: true });
    }
  }, [navigate, routeStep]);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((current) => Math.max(current - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const normalizedPhone = (input) => (input || "").replace(/\D/g, "");

  const maskPhone = (value) => {
    const digits = normalizedPhone(value);
    if (digits.length <= 4) return digits.replace(/\d/g, "•");
    const visible = digits.slice(-4);
    return `${"•".repeat(Math.max(0, digits.length - 4))}${visible}`;
  };

  const validatePhone = (phoneValue) => {
    const digits = normalizedPhone(phoneValue);
    if (!digits) return { ok: false, message: "Please enter a mobile number." };
    if (digits.length !== 10) return { ok: false, message: "Please enter a valid 10-digit Indian mobile number." };
    return { ok: true };
  };

  const sendOtp = async () => {
    const result = validatePhone(phone);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    if (loading || firebaseIsPhoneOtpInProgress()) return;

    setLoading(true);
    setError("");

    try {
      if (!auth) {
        throw new Error("Firebase auth is not configured. Check your VITE_FIREBASE_* environment variables.");
      }
      const formatted = `${phoneCode}${normalizedPhone(phone)}`;
      const verifier = await firebaseCreatePhoneVerifier();
      const newConfirmation = await firebaseSendPhoneOtp(formatted, verifier);

      setConfirmation(newConfirmation, formatted);
      firebaseSetPhoneOtpInProgress(false);
      setOtp("");

      navigate("/register/otp", { state: { phone: formatted } });
    } catch (sendError) {
      console.error("[AUTH] OTP send failed:", sendError);
      const mapped = normalizePhoneOtpError(sendError);
      const fallback = sendError?.message || sendError?.toString() || "Unable to verify this device. Please try again.";
      const message = mapped || fallback;

      setError(message);
      firebaseClearPhoneVerifier();
      firebaseSetPhoneOtpInProgress(false);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (loading) return;

    const currentConfirmation = getConfirmation();
    if (!currentConfirmation) {
      setError("Invalid session. Please go back and request a new code.");
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("[AUTH] OTP verification successful");
      const credential = await currentConfirmation.confirm(otp.trim());
      const uid = credential?.user?.uid || auth?.currentUser?.uid || "";
      clearConfirmation();
      sessionStorage.setItem("kadai.phone.verifiedUid", uid);
      navigate("/register/username", { replace: true, state: { phone: `${phoneCode}${normalizedPhone(phone)}`, uid } });
    } catch (verifyError) {
      const code = verifyError?.code || "";
      let message = "The verification code is incorrect or expired.";
      if (code === "auth/invalid-verification-code") message = "Invalid OTP. Please try again.";
      if (code === "auth/code-expired") message = "The OTP has expired. Request a new code.";
      if (code === "auth/too-many-requests") message = "Too many attempts. Please try again later.";
      if (code === "auth/network-request-failed") message = "Network error. Please check your internet connection and try again.";

      setError(message);
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (seconds > 0 || loading || firebaseIsPhoneOtpInProgress()) return;

    try {
      const formatted = `${phoneCode}${normalizedPhone(phone)}`;
      const verifier = await firebaseCreatePhoneVerifier();
      const nextConfirmation = await firebaseSendPhoneOtp(formatted, verifier);
      setConfirmation(nextConfirmation, formatted);
      setSeconds(30);
      setOtp("");
    } catch (resendError) {
      console.error(resendError);
      const mapped = normalizePhoneOtpError(resendError);
      const fallback = resendError?.message || resendError?.toString() || "Unable to verify this device. Please try again.";
      setError(mapped || fallback);
      firebaseClearPhoneVerifier();
      firebaseSetPhoneOtpInProgress(false);
    }
  };

  const createAccount = async () => {
    if (loading) return;

    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setError("Please enter your username.");
      return;
    }

    setRegistrationUsername(trimmedUsername);
    navigate("/register/address", { replace: true });
  };

  const loadLocationLevel = async (level, values) => {
    const requestId = ++locationRequestIds.current[level];
    setLocationLoading((current) => ({ ...current, [level]: true }));

    try {
      const options = await getRegistrationLocationOptions({ ...values, level });
      if (requestId === locationRequestIds.current[level]) {
        setLocationOptions((current) => ({ ...current, [level]: options }));
      }
    } catch (locationError) {
      console.error(`[AUTH] ${level} lookup failed:`, locationError);
      if (requestId === locationRequestIds.current[level]) {
        setLocationOptions((current) => ({ ...current, [level]: [] }));
        setError(`Unable to load ${level}. Please try again.`);
      }
    } finally {
      if (requestId === locationRequestIds.current[level]) {
        setLocationLoading((current) => ({ ...current, [level]: false }));
      }
    }
  };

  useEffect(() => {
    if (routeStep !== "address") return undefined;

    let active = true;
    const requestId = ++locationRequestIds.current.countries;
    setLocationLoading((current) => ({ ...current, countries: true }));

    getRegistrationCountries()
      .then((countries) => {
        if (!active || requestId !== locationRequestIds.current.countries) return;

        setCountryOptions(countries);
        const defaultCountry = countries.find((country) => country.id === "india") || countries[0];
        if (defaultCountry) {
          setCountryId(defaultCountry.id);
          loadLocationLevel("states", { countryId: defaultCountry.id });
        }
      })
      .catch((locationError) => {
        console.error("[AUTH] Country lookup failed:", locationError);
        if (active) {
          setCountryOptions([]);
          setError("Unable to load countries. Please try again.");
        }
      })
      .finally(() => {
        if (active && requestId === locationRequestIds.current.countries) {
          setLocationLoading((current) => ({ ...current, countries: false }));
        }
      });

    return () => {
      active = false;
    };
  }, [routeStep]);

  const handleCountryChange = (value) => {
    locationRequestIds.current.states += 1;
    locationRequestIds.current.districts += 1;
    locationRequestIds.current.cities += 1;
    locationRequestIds.current.areas += 1;
    setCountryId(value);
    setState("");
    setDistrict("");
    setCity("");
    setArea("");
    setLocationOptions({ states: [], districts: [], cities: [], areas: [] });
    setLocationLoading((current) => ({
      ...current,
      states: false,
      districts: false,
      cities: false,
      areas: false,
    }));

    if (value) loadLocationLevel("states", { countryId: value });
  };

  const handleStateChange = async (value) => {
    locationRequestIds.current.districts += 1;
    locationRequestIds.current.cities += 1;
    locationRequestIds.current.areas += 1;
    setState(value);
    setDistrict("");
    setCity("");
    setArea("");
    setLocationOptions((current) => ({ ...current, districts: [], cities: [], areas: [] }));
    setLocationLoading((current) => ({
      ...current,
      districts: false,
      cities: false,
      areas: false,
    }));

    if (!value) return;

    const stateId = locationOptions.states.find((option) => option.value === value)?.id || value;
    loadLocationLevel("districts", { countryId, stateId });
  };

  const handleDistrictChange = (value) => {
    locationRequestIds.current.cities += 1;
    locationRequestIds.current.areas += 1;
    setDistrict(value);
    setCity("");
    setArea("");
    setLocationOptions((current) => ({ ...current, cities: [], areas: [] }));
    setLocationLoading((current) => ({ ...current, cities: false, areas: false }));
    const stateId = locationOptions.states.find((option) => option.value === state)?.id || state;
    const districtId = locationOptions.districts.find((option) => option.value === value)?.id || value;
    loadLocationLevel("cities", { countryId, stateId, districtId });
  };

  const handleCityChange = (value) => {
    locationRequestIds.current.areas += 1;
    setCity(value);
    setArea("");
    setLocationOptions((current) => ({ ...current, areas: [] }));
    setLocationLoading((current) => ({ ...current, areas: false }));
    const stateId = locationOptions.states.find((option) => option.value === state)?.id || state;
    const districtId = locationOptions.districts.find((option) => option.value === district)?.id || district;
    const cityId = locationOptions.cities.find((option) => option.value === value)?.id || value;
    loadLocationLevel("areas", { countryId, stateId, districtId, cityId });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Location is not supported by this browser.");
      return;
    }

    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(coords.latitude);
        setLongitude(coords.longitude);
        setLocationMode("gps");
        setLoading(false);
      },
      (locationError) => {
        setLoading(false);
        setError(locationError.code === 1 ? "Location permission was denied." : "Unable to detect your current location.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
    );
  };

  const saveRegistration = async () => {
    if (locationMode === "manual" && (!state || !district || !city || !area)) {
      setError("Please select State, District, City, and Area.");
      return;
    }

    if (!auth?.currentUser) {
      setError("Your verification session has expired. Please verify your mobile number again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const verifiedPhone = auth.currentUser.phoneNumber || getRegistrationPhone();
      await updateProfile(auth.currentUser, { displayName: username.trim() });
      await firebaseUpsertCustomerProfile(auth.currentUser.uid, {
        uid: auth.currentUser.uid,
        name: username.trim(),
        fullName: username.trim(),
        displayName: username.trim(),
        mobile: verifiedPhone,
        address: {
          country: countryId,
          state,
          district,
          city,
          area,
          fullAddress: "",
          pincode: "",
          lat: locationMode === "gps" ? latitude : null,
          lon: locationMode === "gps" ? longitude : null,
          locationSource: locationMode,
        },
      });
      clearRegistrationPhone();
      clearRegistrationUsername();
      navigate("/login", { replace: true });
    } catch (saveError) {
      console.error("[AUTH] Registration profile save failed:", saveError);
      setError(saveError?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="register-page">
      <button className="register-back" type="button" onClick={() => navigate("/")}>
        <FiArrowLeft /> Back to Home
      </button>

      <div className="register-container">
        <section className="register-info">
          <div className="register-brand">
            <span>Kadai</span>App
          </div>

          <h1>
            Welcome
            <br />
            to Kadai
          </h1>

          <p>Join and create a secure shopping profile for your next order.</p>

          <div className="register-benefits">
            <div><span>✓</span>Easy and secure shopping</div>
            <div><span>✓</span>Track your orders</div>
            <div><span>✓</span>Save your delivery details</div>
          </div>
        </section>

        <section className="register-card">
          <div id="recaptcha-container" className="recaptcha-container" />

          {routeStep === "phone" && (
            <>
              <div className="register-title">
                <h1>Create your account</h1>
                <p>First, verify your mobile number. We'll send a one time code (OTP).</p>
              </div>

              <div className="register-phone-row">
                <div className="phone-country">
                  <select value={phoneCode} onChange={(event) => {
                    setPhoneCode(event.target.value);
                    setError("");
                  }}>
                    <option value="+91">India (+91)</option>
                  </select>
                </div>

                <div className="phone-input-wrap">
                  <FiPhone />
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value.replace(/\D/g, "").slice(0, 10));
                      setError("");
                    }}
                    placeholder="Mobile number"
                    disabled={loading}
                    maxLength={10}
                  />
                </div>
              </div>

              {error && <div className="error-message" role="alert">{error}</div>}

              <button className="register-submit" type="button" onClick={sendOtp} disabled={loading}>
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </>
          )}

          {routeStep === "otp" && (
            <>
              <div className="register-title">
                <h1>Verify your number</h1>
                <p>Enter the 6-digit code sent to {maskPhone(`${phoneCode}${normalizedPhone(phone)}`)}</p>
              </div>

              <div className="register-otp-area">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="6"
                  value={otp}
                  onChange={(event) => {
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setError("");
                  }}
                  placeholder="000000"
                  disabled={loading}
                />
              </div>

              {error && <div className="error-message" role="alert">{error}</div>}

              <button className="register-submit" type="button" onClick={verifyOtp} disabled={loading}>
                {loading ? "Verifying..." : "Verify & Continue"}
              </button>

              <div className="register-resend">
                <span>Didn't receive the code?</span>
                <button type="button" onClick={resendOtp} disabled={loading || seconds > 0}>
                  {seconds > 0 ? `Resend in 00:${String(seconds).padStart(2, "0")}` : "Resend OTP"}
                </button>
              </div>
            </>
          )}

          {routeStep === "username" && (
            <>
              <div className="register-title">
                <h1>Create your username</h1>
                <p>Choose a username for your Kadai account.</p>
              </div>

              <div className="register-form-grid">
                <div className="register-field">
                  <span>Username</span>
                  <div className="username-wrap">
                    <FiUser />
                    <input
                      type="text"
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);
                        setError("");
                      }}
                      placeholder="Username"
                      disabled={loading}
                    />
                  </div>
                </div>

                {error && <div className="error-message" role="alert">{error}</div>}

                <button className="register-submit" type="button" onClick={createAccount} disabled={loading}>
                  {loading ? "Saving..." : "Create Account"}
                </button>
              </div>
            </>
          )}

          {routeStep === "address" && (
            <>
              <div className="register-title">
                <h1>Choose your location</h1>
                <p>Select your shopping location to show nearby stores and products.</p>
              </div>

              <div className="register-location-mode">
                <button
                  className={locationMode === "gps" ? "active" : ""}
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={loading}
                >
                  Use Current Location
                </button>
                <button
                  className={locationMode === "manual" ? "active" : ""}
                  type="button"
                  onClick={() => {
                    setLocationMode("manual");
                    setLatitude(null);
                    setLongitude(null);
                  }}
                >
                  Add Manually
                </button>
              </div>

              {locationMode === "manual" && (
                <div className="register-form-grid">
                  <div className="register-field">
                    <span>Country</span>
                    <select
                      value={countryId}
                      onChange={(event) => handleCountryChange(event.target.value)}
                      disabled={locationLoading.countries}
                    >
                      <option value="">
                        {locationLoading.countries ? "Loading countries..." : "Select Country"}
                      </option>
                      {countryOptions.map((option) => (
                        <option key={option.id} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="register-field">
                    <span>State</span>
                    <select value={state} onChange={(event) => handleStateChange(event.target.value)} disabled={loading || locationLoading.states || !countryId}>
                      <option value="">{locationLoading.states ? "Loading states..." : "Select State"}</option>
                      {locationOptions.states.map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div className="register-field">
                    <span>District</span>
                    <select value={district} onChange={(event) => handleDistrictChange(event.target.value)} disabled={loading || locationLoading.districts || !state}>
                      <option value="">{locationLoading.districts ? "Loading districts..." : "Select District"}</option>
                      {locationOptions.districts.map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div className="register-field">
                    <span>City</span>
                    <select value={city} onChange={(event) => handleCityChange(event.target.value)} disabled={loading || locationLoading.cities || !district}>
                      <option value="">{locationLoading.cities ? "Loading cities..." : "Select City"}</option>
                      {locationOptions.cities.map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div className="register-field">
                    <span>Area</span>
                    <select value={area} onChange={(event) => setArea(event.target.value)} disabled={loading || locationLoading.areas || !city}>
                      <option value="">{locationLoading.areas ? "Loading areas..." : "Select Area"}</option>
                      {locationOptions.areas.map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {locationMode === "gps" && latitude !== null && (
                <p className="register-location-status">
                  Location detected: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </p>
              )}

              {error && <div className="error-message" role="alert">{error}</div>}

              <button className="register-submit" type="button" onClick={saveRegistration} disabled={loading}>
                {loading ? "Saving..." : "Complete Registration"}
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
};

export default Register;

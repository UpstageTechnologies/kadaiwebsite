import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { FiX } from "react-icons/fi";

const openLocationSettings = () => {
  const platform = navigator.userAgent || "";

  if (/Windows/i.test(platform)) {
    try {
      window.location.href = "ms-settings:privacy-location";
    } catch {
      // Browser may block the OS settings page and will fall back safely.
    }
    return;
  }

  if (/Android/i.test(platform)) {
    try {
      window.location.href = "intent:#Intent;action=android.settings.LOCATION_SOURCE_SETTINGS;end";
    } catch {
      // Browser may block the OS settings page and will fall back safely.
    }
    return;
  }

  if (/iPhone|iPad|iPod/i.test(platform)) {
    try {
      window.location.href = "App-Prefs:root=Privacy&path=LOCATION";
    } catch {
      // Browser may block the OS settings page and will fall back safely.
    }
  }
};

const LOCATION_KEY = "currentLocation";
const LocationContext = createContext(null);

const readStoredLocation = () => {
  try {
    const savedLocation = localStorage.getItem(LOCATION_KEY);
    return savedLocation ? JSON.parse(savedLocation) : null;
  } catch {
    return null;
  }
};

const saveLocation = (location) => {
  localStorage.setItem(LOCATION_KEY, JSON.stringify(location));
};

const getLocationErrorMessage = (geolocationError) => {
  if (!geolocationError) {
    return "Turn on location/GPS and allow this website to predict your current location.";
  }

  if (geolocationError.code === geolocationError.PERMISSION_DENIED) {
    return "Location permission is disabled. Turn on location/GPS and allow this website to use GPS to predict your current location.";
  }

  if (geolocationError.code === geolocationError.POSITION_UNAVAILABLE) {
    return "GPS/location is currently off. Turn on location/GPS and try again so we can predict your current location.";
  }

  if (geolocationError.code === geolocationError.TIMEOUT) {
    return "Location request timed out. Turn on location/GPS and allow access to predict your current location.";
  }

  return "We could not detect your current location. Turn on GPS/location and try again.";
};

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const hasRequestedLocation = useRef(false);

  const dismissPrompt = useCallback(() => {
    setStatus("dismissed");
    setError("");
  }, []);

  const requestLocation = useCallback(() => {
    hasRequestedLocation.current = true;

    if (!navigator.geolocation) {
      setStatus("error");
      setError("Location is not supported by this browser. Turn on GPS support or use a browser that allows GPS detection.");
      return;
    }

    setStatus("loading");
    setError("");

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const coordinates = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coordinates.latitude}&lon=${coordinates.longitude}`,
            { headers: { Accept: "application/json" } }
          );

          if (!response.ok) {
            throw new Error("Unable to find an address for this location.");
          }

          const data = await response.json();
          const detectedLocation = {
            ...coordinates,
            address:
              data.display_name ||
              `${coordinates.latitude}, ${coordinates.longitude}`,
            detectedAt: new Date().toISOString(),
          };

          saveLocation(detectedLocation);
          setLocation(detectedLocation);
          setStatus("success");
        } catch (reverseGeocodeError) {
          setStatus("error");
          setError(
            reverseGeocodeError.message ||
              "We could not convert your current location into an address."
          );
        }
      },
      (geolocationError) => {
        setStatus("error");
        setError(getLocationErrorMessage(geolocationError));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
    );
  }, []);

  const handleEnableGPS = useCallback(() => {
    openLocationSettings();
    requestLocation();
  }, [requestLocation]);

  return (
    <LocationContext.Provider
      value={{ location, status, error, requestLocation }}
    >
      {status !== "success" && status !== "dismissed" && (
        <div className="gps-location-prompt">
          {status === "idle" && (
            <div className="gps-location-prompt-card">
              <button
                type="button"
                className="gps-location-close"
                aria-label="Close location prompt"
                onClick={dismissPrompt}
              >
                <FiX size={16} />
              </button>
              <span className="gps-location-prompt-title">Turn on location</span>
              <span className="gps-location-prompt-copy">
                Enable GPS / location on your device to predict your current location.
              </span>
              <button
                type="button"
                className="gps-location-prompt-button"
                onClick={handleEnableGPS}
              >
                Enable GPS
              </button>
            </div>
          )}

          {status === "loading" && (
            <div className="gps-location-prompt-card loading">
              <button
                type="button"
                className="gps-location-close"
                aria-label="Close location prompt"
                onClick={dismissPrompt}
              >
                <FiX size={16} />
              </button>
              <span className="gps-location-prompt-title">Detecting your current location...</span>
              <span className="gps-location-prompt-copy">
                Please allow GPS / location access to predict the nearest delivery location.
              </span>
            </div>
          )}

          {status === "error" && (
            <div className="gps-location-prompt-card error">
              <button
                type="button"
                className="gps-location-close"
                aria-label="Close location prompt"
                onClick={dismissPrompt}
              >
                <FiX size={16} />
              </button>
              <span className="gps-location-prompt-title">Turn on location</span>
              <span className="gps-location-prompt-copy">{error}</span>
              <button
                type="button"
                className="gps-location-prompt-button"
                onClick={handleEnableGPS}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {children}
    </LocationContext.Provider>
  );
};


export const useLocation = () => {
  const context = useContext(LocationContext);

  if (!context) {
    throw new Error("useLocation must be used within a LocationProvider");
  }

  return context;
};
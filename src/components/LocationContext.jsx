import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { FiX } from "react-icons/fi";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { auth, db } from "../services/firebase";

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

const LOCATION_ERROR_CODES = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
};
const LocationContext = createContext(null);

const getLocationErrorMessage = (geolocationError) => {
  if (!geolocationError) {
    return "Turn on location/GPS and allow this website to predict your current location.";
  }

  if (geolocationError.code === LOCATION_ERROR_CODES.PERMISSION_DENIED) {
    return "Location permission is disabled. Turn on location/GPS and allow this website to use GPS to predict your current location.";
  }

  if (geolocationError.code === LOCATION_ERROR_CODES.POSITION_UNAVAILABLE) {
    return "GPS/location is currently off. Turn on location/GPS and try again so we can predict your current location.";
  }

  if (geolocationError.code === LOCATION_ERROR_CODES.TIMEOUT) {
    return "Location request timed out. Turn on location/GPS and allow access to predict your current location.";
  }

  return "We could not detect your current location. Turn on GPS/location and try again.";
};

export const LocationProvider = ({ children }) => {
  const [transientLocation, setTransientLocation] = useState(null);
  const [requestState, setRequestState] = useState({
    userId: "",
    status: "idle",
    error: "",
  });
  const { user, customer } = useAuth();
  const userId = user?.uid || "";
  const savedLocation = customer?.currentLocation;
  const location = savedLocation && typeof savedLocation === "object"
    ? savedLocation
    : transientLocation?.userId === userId
      ? transientLocation.location
      : null;
  const requestStatus = requestState.userId === userId ? requestState.status : "idle";
  const status = location && requestStatus === "idle" ? "success" : requestStatus;
  const error = requestState.userId === userId ? requestState.error : "";

  const dismissPrompt = useCallback(() => {
    setRequestState({ userId, status: "dismissed", error: "" });
  }, [userId]);

  const requestLocation = useCallback(() => {
    const requestUid = auth?.currentUser?.uid || "";

    if (!navigator.geolocation) {
      setRequestState({
        userId: requestUid,
        status: "error",
        error: "Location is not supported by this browser. Turn on GPS support or use a browser that allows GPS detection.",
      });
      return;
    }

    setRequestState({ userId: requestUid, status: "loading", error: "" });

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
            lat: coordinates.latitude,
            lon: coordinates.longitude,
            address:
              data.display_name ||
              `${coordinates.latitude}, ${coordinates.longitude}`,
            detectedAt: new Date().toISOString(),
          };

          if (requestUid && auth?.currentUser?.uid !== requestUid) {
            throw new Error("Your Firebase session changed. Please request your location again.");
          }
          if (requestUid && db) {
            await updateDoc(doc(db, "customers", requestUid), {
              currentLocation: detectedLocation,
            });
          }

          setTransientLocation({ userId: requestUid, location: detectedLocation });
          setRequestState({ userId: requestUid, status: "success", error: "" });
        } catch (reverseGeocodeError) {
          setRequestState({
            userId: requestUid,
            status: "error",
            error: reverseGeocodeError.message
              || "We could not convert your current location into an address.",
          });
        }
      },
      (geolocationError) => {
        setRequestState({
          userId: requestUid,
          status: "error",
          error: getLocationErrorMessage(geolocationError),
        });
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
      {status === "error" && (
        <div className="gps-location-prompt">
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
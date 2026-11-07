import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { FiX } from "react-icons/fi";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { auth, db } from "../services/firebase";
import { getCustomerActiveLocation } from "../services/marketplace.service";
import {
  getActiveLocationStorageKey,
  getCachedLocation,
  getCurrentLocationAddress,
  saveActiveLocation,
} from "../services/current-location-address.service";
import LocationSelectionModal from "./LocationSelectionModal";

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
  const [transientLocation, setTransientLocation] = useState(() => {
    const cachedLocation = getCachedLocation();
    return cachedLocation
      ? { userId: "", location: cachedLocation }
      : null;
  });
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false);
  const [requestState, setRequestState] = useState({
    userId: "",
    status: "idle",
    error: "",
  });
  const locationRequestId = useRef(0);
  const { user, customer } = useAuth();
  const userId = user?.uid || "";
  const savedLocation = getCustomerActiveLocation(customer);
  const location = transientLocation?.userId === userId
    ? transientLocation.location
    : savedLocation && typeof savedLocation === "object"
      ? savedLocation
      : getCachedLocation(getActiveLocationStorageKey(userId));

  const requestStatus = requestState.userId === userId ? requestState.status : "idle";
  const status = location && requestStatus === "idle" ? "success" : requestStatus;
  const error = requestState.userId === userId ? requestState.error : "";

  const dismissPrompt = useCallback(() => {
    setRequestState({ userId, status: "dismissed", error: "" });
  }, [userId]);

  const requestLocation = useCallback(async () => {
    const requestUid = auth?.currentUser?.uid || "";
    const requestId = ++locationRequestId.current;

    if (!navigator.geolocation) {
      setRequestState({
        userId: requestUid,
        status: "error",
        error: "Location is not supported by this browser. Turn on GPS support or use a browser that allows GPS detection.",
      });
      return null;
    }

    setRequestState({ userId: requestUid, status: "loading", error: "" });
    try {
      const detectedAddress = await getCurrentLocationAddress();
      if (requestId !== locationRequestId.current) return null;

      const detectedLocation = {
        ...detectedAddress,
        lat: detectedAddress.lat ?? detectedAddress.latitude,
        lon: detectedAddress.lon ?? detectedAddress.longitude,
        address: detectedAddress.fullAddress || detectedAddress.formattedAddress,
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
      if (requestId !== locationRequestId.current) return null;

      saveActiveLocation(
        detectedLocation,
        getActiveLocationStorageKey(requestUid)
      );
      setTransientLocation({ userId: requestUid, location: detectedLocation });
      setRequestState({ userId: requestUid, status: "success", error: "" });
      return detectedLocation;
    } catch (locationError) {
      if (requestId !== locationRequestId.current) return null;

      setRequestState({
        userId: requestUid,
        status: "error",
        error: locationError.code
          ? getLocationErrorMessage(locationError)
          : locationError.message || "We could not detect your current location. Please choose a location manually.",
      });
      return null;
    }
  }, []);

  const selectLocation = useCallback((selectedLocation) => {
    locationRequestId.current += 1;
    const requestUid = auth?.currentUser?.uid || "";
    const savedLocation = saveActiveLocation(
      selectedLocation,
      getActiveLocationStorageKey(requestUid)
    );
    setTransientLocation({
      userId: requestUid,
      location: savedLocation || selectedLocation,
    });
    setRequestState({ userId: requestUid, status: "success", error: "" });
  }, []);

  const openLocationSelector = useCallback(() => {
    setIsLocationSelectorOpen(true);
  }, []);

  const closeLocationSelector = useCallback(() => {
    setIsLocationSelectorOpen(false);
  }, []);

  const handleEnableGPS = useCallback(() => {
    openLocationSettings();
    requestLocation();
  }, [requestLocation]);

  return (
    <LocationContext.Provider
      value={{
        location,
        status,
        error,
        requestLocation,
        selectLocation,
        openLocationSelector,
      }}
    >
      {status === "error" && !isLocationSelectorOpen && (
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
      <LocationSelectionModal
        open={isLocationSelectorOpen}
        onClose={closeLocationSelector}
        onSelectLocation={(selectedLocation) => {
          selectLocation(selectedLocation);
          closeLocationSelector();
        }}
        location={location}
        status={status}
        error={error}
        requestLocation={requestLocation}
      />
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
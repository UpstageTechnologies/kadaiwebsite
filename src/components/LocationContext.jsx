import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(readStoredLocation);
  const [status, setStatus] = useState(() =>
    location ? "success" : "idle"
  );
  const [error, setError] = useState("");
  const hasRequestedLocation = useRef(false);

  const requestLocation = useCallback(() => {
    hasRequestedLocation.current = true;

    if (!navigator.geolocation) {
      setStatus("error");
      setError("Location is not supported by this browser.");
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
              "We could not convert your location into an address."
          );
        }
      },
      (geolocationError) => {
        setStatus("error");
        setError(
          geolocationError.code === geolocationError.PERMISSION_DENIED
            ? "Location access is disabled. Enable it in your browser settings."
            : "We could not detect your location. Please try again."
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  useEffect(() => {
    if (!location && !hasRequestedLocation.current) {
      requestLocation();
    }
  }, [location, requestLocation]);

  return (
    <LocationContext.Provider
      value={{ location, status, error, requestLocation }}
    >
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
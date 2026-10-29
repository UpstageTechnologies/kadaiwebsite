import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMapPin, FiArrowLeft, FiPlus, FiNavigation, FiTrash2, FiCheck } from "react-icons/fi";
import { useAuth } from "../../components/AuthContext";
import {
  firebaseDeleteSavedAddress,
  firebaseFetchSavedAddresses,
  firebaseSaveActiveAddress,
} from "../../services/firebase";
import {
  getRegistrationCountries,
  getRegistrationLocationOptions,
} from "../../services/registration-location.service";
import {
  getCurrentLocationAddress,
  getManualAddressCoordinates,
} from "../../services/current-location-address.service";
import "./location-picker.css";

const validCoordinates = (lat, lon) => {
  const latitude = Number(lat);
  const longitude = Number(lon);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
};

const locationLabel = (address = {}) => {
  const parts = [address.area, address.city, address.district, address.state, address.country, address.pincode]
    .filter(Boolean)
    .map((part) => String(part).trim())
    .filter(Boolean);
  return [...new Set(parts)].slice(0, 4).join(", ") || address.fullAddress || address.formattedAddress || "Location not set";
};

const LocationPicker = () => {
  const navigate = useNavigate();
  const { user, customer } = useAuth();
  const [savedLocations, setSavedLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [mode, setMode] = useState("");
  const [error, setError] = useState("");

  const [detectedAddress, setDetectedAddress] = useState(null);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [cityId, setCityId] = useState("");
  const [areaId, setAreaId] = useState("");

  const loadSavedLocations = async () => {
    if (!user?.uid) return;
    try {
      setSavedLocations(await firebaseFetchSavedAddresses(user.uid));
    } catch (loadError) {
      setError(loadError.message || "Unable to load saved locations.");
    }
  };

  useEffect(() => {
    loadSavedLocations();
  }, [user?.uid]);

  const resetForm = () => {
    setMode("");
    setDetectedAddress(null);
    setCountryId("");
    setStateId("");
    setDistrictId("");
    setCityId("");
    setAreaId("");
    setStates([]);
    setDistricts([]);
    setCities([]);
    setAreas([]);
    setError("");
  };

  const openAddLocation = async () => {
    resetForm();
    setShowAddLocation(true);
    try {
      setCountries(await getRegistrationCountries());
    } catch (loadError) {
      setError(loadError.message || "Unable to load countries.");
    }
  };

  const selectCountry = async (id) => {
    setCountryId(id);
    setStateId("");
    setDistrictId("");
    setCityId("");
    setAreaId("");
    setDistricts([]); setCities([]); setAreas([]);
    try {
      setStates(await getRegistrationLocationOptions({ countryId: id, level: "states" }));
    } catch {
      setStates([]);
    }
  };

  const selectState = async (id) => {
    setStateId(id);
    setDistrictId(""); setCityId(""); setAreaId("");
    setCities([]); setAreas([]);
    try {
      setDistricts(await getRegistrationLocationOptions({ countryId, stateId: id, level: "districts" }));
    } catch {
      setDistricts([]);
    }
  };

  const selectDistrict = async (id) => {
    setDistrictId(id);
    setCityId(""); setAreaId(""); setAreas([]);
    try {
      setCities(await getRegistrationLocationOptions({ countryId, stateId, districtId: id, level: "cities" }));
    } catch {
      setCities([]);
    }
  };

  const selectCity = async (id) => {
    setCityId(id);
    setAreaId("");
    try {
      setAreas(await getRegistrationLocationOptions({ countryId, stateId, districtId, cityId: id, level: "areas" }));
    } catch {
      setAreas([]);
    }
  };

  const useCurrentLocation = async () => {
    setMode("gps");
    setError("");
    setLoading(true);
    try {
      setDetectedAddress(await getCurrentLocationAddress());
    } catch (locationError) {
      setDetectedAddress(null);
      setError(locationError.message || "Unable to detect your current location.");
    } finally {
      setLoading(false);
    }
  };

  const chooseManual = () => {
    setMode("manual");
    setDetectedAddress(null);
    setError("");
  };

  const saveLocation = async () => {
    if (!user?.uid) {
      setError("Please login again before saving a location.");
      return;
    }

    let payload;
    try {
      setLoading(true);
      setError("");
      if (mode === "gps") {
        if (!detectedAddress || !validCoordinates(detectedAddress.lat, detectedAddress.lon)) {
          throw new Error("Please detect your current location first.");
        }
        payload = { ...detectedAddress, isActive: true, timestamp: new Date().toISOString(), locationSource: "gps" };
      } else if (mode === "manual") {
        if (!countryId || !stateId || !districtId || !cityId || !areaId) {
          throw new Error("Please select Country, State, District, City and Area.");
        }
        const country = countries.find((item) => item.id === countryId);
        const state = states.find((item) => item.id === stateId);
        const district = districts.find((item) => item.id === districtId);
        const city = cities.find((item) => item.id === cityId);
        const area = areas.find((item) => item.id === areaId);
        const address = {
          type: "Location",
          country: country?.label || country?.value || "",
          state: state?.label || "",
          district: district?.label || "",
          city: city?.label || "",
          area: area?.label || "",
        };
        const coordinates = await getManualAddressCoordinates({
          ...address,
          countryId,
          stateId,
          districtId,
          cityId,
        });
        payload = { ...address, ...coordinates, locationSource: "manual", isActive: true, timestamp: new Date().toISOString() };
      } else {
        throw new Error("Choose Current Location or Add New Address.");
      }

      await firebaseSaveActiveAddress(user.uid, payload);
      await loadSavedLocations();
      setShowAddLocation(false);
      resetForm();
    } catch (saveError) {
      setError(saveError.message || "Unable to save this location.");
    } finally {
      setLoading(false);
    }
  };

  const activateLocation = async (address) => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      setError("");
      await firebaseSaveActiveAddress(user.uid, address, address.id?.startsWith("registered_") ? "" : address.id);
      await loadSavedLocations();
    } catch (activateError) {
      setError(activateError.message || "Unable to activate this location.");
    } finally {
      setLoading(false);
    }
  };

  const deleteLocation = async (address) => {
    if (!user?.uid || !address.id || address.id === "registered_primary_addr") return;
    if (!window.confirm("Remove this saved location?")) return;
    try {
      setLoading(true);
      await firebaseDeleteSavedAddress(user.uid, address.id);
      await loadSavedLocations();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete this location.");
    } finally {
      setLoading(false);
    }
  };

  const activeAddress = savedLocations.find((item) => item.isActive)
    || customer?.currentLocation
    || customer?.address;

  return (
    <main className="location-picker-page">
      <section className="location-picker-shell">
        <button type="button" className="location-picker-back" onClick={() => navigate(-1)}>
          <FiArrowLeft /> Back
        </button>

        <div className="location-picker-card">
          <div className="location-picker-icon"><FiMapPin size={44} /></div>
          <span className="location-picker-kicker">Shopping location</span>
          <h1>Where do you want to shop from?</h1>
          <p>Pick your current GPS position or a saved location. This controls the local product feed.</p>

          {error && <div className="location-picker-error" role="alert">{error}</div>}

          <div className="active-location-card">
            <span className="active-location-label">{activeAddress?.isActive === false ? "Saved location" : "Active location"}</span>
            <strong>{locationLabel(activeAddress || {})}</strong>
            {validCoordinates(activeAddress?.lat, activeAddress?.lon) && (
              <small>{Number(activeAddress.lat).toFixed(6)}, {Number(activeAddress.lon).toFixed(6)}</small>
            )}
          </div>

          {!showAddLocation ? (
            <>
              <button type="button" className="location-picker-button add-location-button" onClick={openAddLocation} disabled={loading || !user?.uid}>
                <FiPlus /> Add New Location
              </button>

              {savedLocations.length > 0 && (
                <div className="saved-location-list">
                  <div className="saved-location-heading"><strong>Saved locations</strong><span>{savedLocations.length}</span></div>
                  {savedLocations.map((address) => (
                    <div className={`saved-location-row ${address.isActive ? "active" : ""}`} key={address.id}>
                      <FiMapPin />
                      <div>
                        <strong>{locationLabel(address)}</strong>
                        <small>{address.locationSource === "gps" ? "Current location" : "Added manually"}</small>
                      </div>
                      {address.isActive ? <span className="active-mini"><FiCheck /> Active</span> : (
                        <button type="button" className="location-use-button" onClick={() => activateLocation(address)} disabled={loading}>Use</button>
                      )}
                      <button type="button" className="location-delete-button" aria-label="Delete location" onClick={() => deleteLocation(address)} disabled={loading || address.isActive || address.id === "registered_primary_addr"}>
                        <FiTrash2 />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="location-add-form">
              <div className="location-mode-actions">
                <button type="button" className={mode === "gps" ? "selected" : ""} onClick={useCurrentLocation} disabled={loading}><FiNavigation /> Use Current Location</button>
                <button type="button" className={mode === "manual" ? "selected" : ""} onClick={chooseManual}><FiMapPin /> Add Manually</button>
              </div>

              {mode === "gps" && detectedAddress && (
                <div className="detected-location">
                  <strong>{locationLabel(detectedAddress)}</strong>
                  <small>{detectedAddress.formattedAddress || detectedAddress.fullAddress}</small>
                </div>
              )}

              {mode === "manual" && (
                <div className="location-select-grid">
                  <select value={countryId} onChange={(event) => selectCountry(event.target.value)}><option value="">Select Country</option>{countries.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
                  <select value={stateId} onChange={(event) => selectState(event.target.value)} disabled={!countryId}><option value="">Select State</option>{states.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
                  <select value={districtId} onChange={(event) => selectDistrict(event.target.value)} disabled={!stateId}><option value="">Select District</option>{districts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
                  <select value={cityId} onChange={(event) => selectCity(event.target.value)} disabled={!districtId}><option value="">Select City</option>{cities.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
                  <select value={areaId} onChange={(event) => setAreaId(event.target.value)} disabled={!cityId}><option value="">Select Area</option>{areas.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
                </div>
              )}

              <div className="location-form-actions">
                <button type="button" className="location-picker-button" onClick={saveLocation} disabled={loading}>{loading ? "Saving..." : "Save Location"}</button>
                <button type="button" className="location-cancel-button" onClick={() => { resetForm(); setShowAddLocation(false); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default LocationPicker;

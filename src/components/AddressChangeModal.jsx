                                                                                                     import { useEffect, useRef, useState } from "react";
import {
  auth,
  firebaseCustomerSnapshot,
  firebaseUpdateCustomer,
} from "../services/firebase";
import {
  getRegistrationCountries,
  getRegistrationLocationOptions,
} from "../services/registration-location.service";
import { getCurrentLocationAddress } from "../services/current-location-address.service";

const normalizeAddress = (value = {}) => ({
  country: value.country || "",
  house: value.house || "",
  road: value.road || "",
  state: value.state || "",
  district: value.district || "",
  city: value.city || "",
  area: value.area || "",
  fullAddress: value.fullAddress || value.address || "",
  pincode: value.pincode || "",
  lat: value.lat ?? null,
  lon: value.lon ?? null,
  locationSource: value.locationSource === "gps" ? "gps" : "manual",
});

export default function AddressChangeModal({ open, onClose, onSaved }) {
  const [addressError, setAddressError] = useState("");
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isDetectingAddress, setIsDetectingAddress] = useState(false);
  const [addressMode, setAddressMode] = useState("manual");
  const [addressCountryOptions, setAddressCountryOptions] = useState([]);
  const [addressStateOptions, setAddressStateOptions] = useState([]);
  const [addressDistrictOptions, setAddressDistrictOptions] = useState([]);
  const [addressCityOptions, setAddressCityOptions] = useState([]);
  const [addressAreaOptions, setAddressAreaOptions] = useState([]);
  const [addressCountryId, setAddressCountryId] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressDistrict, setAddressDistrict] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressArea, setAddressArea] = useState("");
  const [addressHouse, setAddressHouse] = useState("");
  const [addressRoad, setAddressRoad] = useState("");
  const [addressFullFallback, setAddressFullFallback] = useState("");
  const [addressPincode, setAddressPincode] = useState("");
  const [addressLatitude, setAddressLatitude] = useState(null);
  const [addressLongitude, setAddressLongitude] = useState(null);
  const addressDetectionId = useRef(0);
  const [addressLoading, setAddressLoading] = useState({
    countries: false,
    states: false,
    districts: false,
    cities: false,
    areas: false,
  });

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let active = true;
    const detectionId = addressDetectionId.current;

    const loadCustomerAddress = async () => {
      setAddressCountryId("");
      setAddressState("");
      setAddressDistrict("");
      setAddressCity("");
      setAddressArea("");
      setAddressHouse("");
      setAddressRoad("");
      setAddressFullFallback("");
      setAddressPincode("");
      setAddressLatitude(null);
      setAddressLongitude(null);
      setAddressMode("manual");
      setAddressError("");

      try {
        if (auth && typeof auth.authStateReady === "function") {
          await auth.authStateReady();
        }

        const firebaseUser = auth?.currentUser || null;
        console.log("[ADDRESS DEBUG] Firebase auth user:", firebaseUser);

        if (!firebaseUser || !firebaseUser.uid) {
          setAddressError("Your Firebase session is missing. Please log in again.");
          return;
        }

        const customerUid = firebaseUser.uid;
        console.log("[ADDRESS DEBUG] Firebase auth UID:", customerUid);

        const customerSnapshot = await firebaseCustomerSnapshot(customerUid);
        const customerData = customerSnapshot?.data?.() || {};
        const customerAddress = normalizeAddress(customerData.address || {});

        if (!active || detectionId !== addressDetectionId.current) {
          return;
        }

        console.log("[ADDRESS DEBUG] customer document path:", `customers/${customerUid}`);

        setAddressCountryId(customerAddress.country || "");
        setAddressHouse(customerAddress.house || "");
        setAddressRoad(customerAddress.road || "");
        setAddressFullFallback(customerAddress.fullAddress || "");
        setAddressState(customerAddress.state || "");
        setAddressDistrict(customerAddress.district || "");
        setAddressCity(customerAddress.city || "");
        setAddressArea(customerAddress.area || "");
        setAddressPincode(customerAddress.pincode || "");
        setAddressLatitude(customerAddress.lat ?? null);
        setAddressLongitude(customerAddress.lon ?? null);
        setAddressMode(customerAddress.locationSource === "gps" ? "gps" : "manual");
      } catch (error) {
        console.error("[ADDRESS MODAL] Failed to load customer address:", error);
        if (active) {
          setAddressError(error?.message || "Unable to load your saved address. Please try again.");
        }
      }
    };

    loadCustomerAddress();

    const loadCountries = async () => {
      try {
        setAddressLoading((current) => ({ ...current, countries: true }));
        const countries = await getRegistrationCountries();
        if (active) {
          setAddressCountryOptions(countries);
        }
      } catch (error) {
        console.error("[ADDRESS MODAL] Country load failed:", error);
      } finally {
        if (active) {
          setAddressLoading((current) => ({ ...current, countries: false }));
        }
      }
    };

    loadCountries();

    return () => {
      active = false;
      addressDetectionId.current += 1;
    };
  }, [open]);

  const loadAddressOptions = async (level, values) => {
    const detectionId = addressDetectionId.current;
    try {
      setAddressLoading((current) => ({ ...current, [level]: true }));
      const options = await getRegistrationLocationOptions({ ...values, level });
      if (detectionId !== addressDetectionId.current) return;

      if (level === "states") {
        setAddressStateOptions(options);
      }
      if (level === "districts") {
        setAddressDistrictOptions(options);
      }
      if (level === "cities") {
        setAddressCityOptions(options);
      }
      if (level === "areas") {
        setAddressAreaOptions(options);
      }
    } catch (error) {
      if (detectionId !== addressDetectionId.current) return;
      console.error("[ADDRESS MODAL] Address level load failed:", error);
      setAddressError("Unable to load location details. Please try again.");
    } finally {
      if (detectionId === addressDetectionId.current) {
        setAddressLoading((current) => ({ ...current, [level]: false }));
      }
    }
  };

  useEffect(() => {
    if (!open || addressMode !== "manual" || !addressCountryId) {
      return;
    }

    loadAddressOptions("states", { countryId: addressCountryId });
  }, [open, addressMode, addressCountryId]);

  useEffect(() => {
    if (!open || addressMode !== "manual" || !addressCountryId || !addressState) {
      return;
    }

    loadAddressOptions("districts", {
      countryId: addressCountryId,
      stateId: addressState,
    });
  }, [open, addressMode, addressCountryId, addressState]);

  useEffect(() => {
    if (!open || addressMode !== "manual" || !addressCountryId || !addressState || !addressDistrict) {
      return;
    }

    loadAddressOptions("cities", {
      countryId: addressCountryId,
      stateId: addressState,
      districtId: addressDistrict,
    });
  }, [open, addressMode, addressCountryId, addressState, addressDistrict]);

  useEffect(() => {
    if (!open || addressMode !== "manual" || !addressCountryId || !addressState || !addressDistrict || !addressCity) {
      return;
    }

    loadAddressOptions("areas", {
      countryId: addressCountryId,
      stateId: addressState,
      districtId: addressDistrict,
      cityId: addressCity,
    });
  }, [open, addressMode, addressCountryId, addressState, addressDistrict, addressCity]);

  const handleCurrentLocation = async () => {
    const detectionId = ++addressDetectionId.current;
    setAddressMode("gps");
    setAddressError("");
    setIsDetectingAddress(true);
    setAddressCountryId("");
    setAddressState("");
    setAddressDistrict("");
    setAddressCity("");
    setAddressArea("");
    setAddressHouse("");
    setAddressRoad("");
    setAddressPincode("");
    setAddressLatitude(null);
    setAddressLongitude(null);
    setAddressFullFallback("");
    setAddressStateOptions([]);
    setAddressDistrictOptions([]);
    setAddressCityOptions([]);
    setAddressAreaOptions([]);
    try {
      const detectedAddress = await getCurrentLocationAddress();
      if (detectionId !== addressDetectionId.current) return;
      setAddressHouse(detectedAddress.house);
      setAddressRoad(detectedAddress.road);
      setAddressFullFallback(detectedAddress.fullAddress);
      setAddressPincode(detectedAddress.pincode);
      setAddressLatitude(detectedAddress.latitude);
      setAddressLongitude(detectedAddress.longitude);
      setAddressCountryId(detectedAddress.matches.country?.id || detectedAddress.country);
      setAddressState(detectedAddress.matches.state?.id || detectedAddress.state);
      setAddressDistrict(detectedAddress.matches.district?.id || detectedAddress.district);
      setAddressCity(detectedAddress.matches.city?.id || detectedAddress.city);
      setAddressArea(detectedAddress.matches.area?.id || detectedAddress.area);
      setAddressCountryOptions(detectedAddress.options.countries);
      setAddressStateOptions(detectedAddress.options.states);
      setAddressDistrictOptions(detectedAddress.options.districts);
      setAddressCityOptions(detectedAddress.options.cities);
      setAddressAreaOptions(detectedAddress.options.areas);
    } catch (error) {
      if (detectionId !== addressDetectionId.current) return;
      console.error("[ADDRESS MODAL] Current location detection failed:", error);
      setAddressError(error?.message || "We could not convert your current location into an address. Please enter your address manually.");
    } finally {
      if (detectionId === addressDetectionId.current) {
        setAddressLoading({
          countries: false,
          states: false,
          districts: false,
          cities: false,
          areas: false,
        });
        setIsDetectingAddress(false);
      }
    }
  };

  const handleSave = async () => {
    try {
      if (auth && typeof auth.authStateReady === "function") {
        await auth.authStateReady();
      }

      const firebaseUser = auth?.currentUser || null;
      console.log("[ADDRESS DEBUG] Firebase auth user:", firebaseUser);

      if (!firebaseUser || !firebaseUser.uid) {
        setAddressError("Your Firebase session is missing. Please log in again.");
        console.error("[ADDRESS DEBUG] No authenticated Firebase user available for address update.");
        return;
      }

      const customerUid = firebaseUser.uid;
      console.log("[ADDRESS DEBUG] Firebase auth UID:", customerUid);

      if (addressMode === "manual") {
        if (!addressCountryId || !addressState || !addressDistrict || !addressCity || !addressArea) {
          setAddressError("Please select Country, State, District, City, and Area.");
          return;
        }
      }

      if (addressMode === "gps" && (addressLatitude === null || addressLongitude === null)) {
        setAddressError("Please wait for your current location to be detected.");
        return;
      }

      const optionLabel = (options, value) =>
        options.find((option) => option.id === value || option.value === value)?.label || value;
      const addressParts = addressMode === "gps"
        ? [addressHouse, addressRoad, addressPincode]
        : [
          optionLabel(addressAreaOptions, addressArea),
          optionLabel(addressCityOptions, addressCity),
          optionLabel(addressDistrictOptions, addressDistrict),
          optionLabel(addressStateOptions, addressState),
          optionLabel(addressCountryOptions, addressCountryId),
        ];
      const fullAddress = addressParts
        .map((part) => String(part || "").trim())
        .filter((part, index, parts) => part && parts.indexOf(part) === index)
        .join(", ") || (addressMode === "gps" ? addressFullFallback : "");
      const nextAddress = {
        country: addressMode === "manual" ? addressCountryId : "",
        house: addressMode === "gps" ? addressHouse.trim() : "",
        road: addressMode === "gps" ? addressRoad.trim() : "",
        state: addressMode === "manual" ? addressState : "",
        district: addressMode === "manual" ? addressDistrict : "",
        city: addressMode === "manual" ? addressCity : "",
        area: addressMode === "manual" ? addressArea : "",
        fullAddress,
        pincode: addressMode === "gps" ? addressPincode.trim() : "",
        lat: addressMode === "gps" ? addressLatitude : null,
        lon: addressMode === "gps" ? addressLongitude : null,
        locationSource: addressMode === "gps" ? "gps" : "manual",
        address: fullAddress,
      };

      setIsSavingAddress(true);
      setAddressError("");

      console.log("[ADDRESS DEBUG] customer document path:", `customers/${customerUid}`);
      console.log("[ADDRESS DEBUG] successful customer update:", `customers/${customerUid}`);

      await firebaseUpdateCustomer(customerUid, { address: nextAddress });
      onSaved?.(nextAddress);
      onClose();
    } catch (error) {
      console.error("[ADDRESS MODAL] Address save failed:", error);
      setAddressError(error?.message || "Unable to update your address. Please try again.");
    } finally {
      setIsSavingAddress(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.38)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1200,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 20px 45px rgba(15, 23, 42, 0.18)",
          padding: 24,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <strong style={{ fontSize: 18, color: "#1f2937" }}>Address</strong>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: 22,
              cursor: "pointer",
              color: "#334155",
            }}
          >
            ×
          </button>
        </div>

        {addressError && (
          <div
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              background: "#fff1f2",
              color: "#9f1239",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {addressError}
          </div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={isDetectingAddress}
              onClick={handleCurrentLocation}
              style={{
                border: addressMode === "gps" ? "1px solid #65a91a" : "1px solid #cbd5e1",
                background: addressMode === "gps" ? "#f7fbf3" : "#fff",
                color: "#356d1d",
                borderRadius: 8,
                padding: "10px 12px",
                cursor: "pointer",
              }}
            >
              {isDetectingAddress ? "Detecting Location..." : "Use Current Location"}
            </button>
            <button
              type="button"
              onClick={() => {
                addressDetectionId.current += 1;
                setIsDetectingAddress(false);
                setAddressMode("manual");
                setAddressHouse("");
                setAddressRoad("");
                setAddressPincode("");
                setAddressLatitude(null);
                setAddressLongitude(null);
                setAddressFullFallback("");
                setAddressCountryId("");
                setAddressState("");
                setAddressDistrict("");
                setAddressCity("");
                setAddressArea("");
                setAddressStateOptions([]);
                setAddressDistrictOptions([]);
                setAddressCityOptions([]);
                setAddressAreaOptions([]);
              }}
              style={{
                border: addressMode === "manual" ? "1px solid #65a91a" : "1px solid #cbd5e1",
                background: addressMode === "manual" ? "#f7fbf3" : "#fff",
                color: "#374151",
                borderRadius: 8,
                padding: "10px 12px",
                cursor: "pointer",
              }}
            >
              Manual Address
            </button>
          </div>

          {addressMode === "gps" ? (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <input
              type="text"
              value={addressHouse}
              onChange={(event) => setAddressHouse(event.target.value)}
              placeholder="House no. / Building Name"
              style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
            />
            <input
              type="text"
              value={addressRoad}
              onChange={(event) => setAddressRoad(event.target.value)}
              placeholder="Road Name / Area / Colony"
              style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
            />
            <input
              type="text"
              value={addressPincode}
              onChange={(event) => setAddressPincode(event.target.value)}
              placeholder="Pincode"
              style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
            />
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <select
              value={addressCountryId}
              onChange={(event) => {
                setAddressCountryId(event.target.value);
                setAddressState("");
                setAddressDistrict("");
                setAddressCity("");
                setAddressArea("");
              }}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
            >
              <option value="">Select Country</option>
              {addressCountryOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>

            <select
              value={addressState}
              onChange={(event) => {
                setAddressState(event.target.value);
                setAddressDistrict("");
                setAddressCity("");
                setAddressArea("");
              }}
              disabled={!addressCountryId || addressLoading.states}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
            >
              <option value="">Select State</option>
              {addressStateOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>

            <select
              value={addressDistrict}
              onChange={(event) => {
                setAddressDistrict(event.target.value);
                setAddressCity("");
                setAddressArea("");
              }}
              disabled={!addressState || addressLoading.districts}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
            >
              <option value="">Select District</option>
              {addressDistrictOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>

            <select
              value={addressCity}
              onChange={(event) => {
                setAddressCity(event.target.value);
                setAddressArea("");
              }}
              disabled={!addressDistrict || addressLoading.cities}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
            >
              <option value="">Select City</option>
              {addressCityOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>

            <select
              value={addressArea}
              onChange={(event) => setAddressArea(event.target.value)}
              disabled={!addressCity || addressLoading.areas}
              style={{ gridColumn: "1 / -1", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
            >
              <option value="">Select Area</option>
              {addressAreaOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#374151",
              borderRadius: 8,
              padding: "10px 14px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSavingAddress}
            style={{
              border: "none",
              background: "#65a91a",
              color: "#fff",
              borderRadius: 8,
              padding: "10px 14px",
              cursor: isSavingAddress ? "not-allowed" : "pointer",
              opacity: isSavingAddress ? 0.7 : 1,
            }}
          >
            {isSavingAddress ? "Saving..." : "Save Address"}
          </button>
        </div>
      </div>
    </div>
  );
}
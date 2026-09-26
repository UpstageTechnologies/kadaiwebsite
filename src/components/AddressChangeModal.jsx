import { useEffect, useState } from "react";
import { firebaseUpdateCustomer } from "../services/firebase";
import {
  getRegistrationCountries,
  getRegistrationLocationOptions,
} from "../services/registration-location.service";

const readRegisteredCustomer = () => {
  try {
    return JSON.parse(localStorage.getItem("registeredUser") || "null");
  } catch {
    return null;
  }
};

const normalizeAddress = (value = {}) => ({
  country: value.country || "",
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
  const [addressFull, setAddressFull] = useState("");
  const [addressPincode, setAddressPincode] = useState("");
  const [addressLatitude, setAddressLatitude] = useState(null);
  const [addressLongitude, setAddressLongitude] = useState(null);
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

    const customer = readRegisteredCustomer();
    const currentAddress = normalizeAddress(customer?.address || {});

    setAddressCountryId(currentAddress.country || "");
    setAddressState(currentAddress.state || "");
    setAddressDistrict(currentAddress.district || "");
    setAddressCity(currentAddress.city || "");
    setAddressArea(currentAddress.area || "");
    setAddressFull(currentAddress.fullAddress || "");
    setAddressPincode(currentAddress.pincode || "");
    setAddressLatitude(currentAddress.lat ?? null);
    setAddressLongitude(currentAddress.lon ?? null);
    setAddressMode(currentAddress.locationSource === "gps" ? "gps" : "manual");
    setAddressError("");

    let active = true;
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
    };
  }, [open]);

  const loadAddressOptions = async (level, values) => {
    try {
      setAddressLoading((current) => ({ ...current, [level]: true }));
      const options = await getRegistrationLocationOptions({ ...values, level });

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
      console.error("[ADDRESS MODAL] Address level load failed:", error);
      setAddressError("Unable to load location details. Please try again.");
    } finally {
      setAddressLoading((current) => ({ ...current, [level]: false }));
    }
  };

  useEffect(() => {
    if (!open || !addressCountryId) {
      return;
    }

    loadAddressOptions("states", { countryId: addressCountryId });
  }, [open, addressCountryId]);

  useEffect(() => {
    if (!open || !addressCountryId || !addressState) {
      return;
    }

    loadAddressOptions("districts", {
      countryId: addressCountryId,
      stateId: addressState,
    });
  }, [open, addressCountryId, addressState]);

  useEffect(() => {
    if (!open || !addressCountryId || !addressState || !addressDistrict) {
      return;
    }

    loadAddressOptions("cities", {
      countryId: addressCountryId,
      stateId: addressState,
      districtId: addressDistrict,
    });
  }, [open, addressCountryId, addressState, addressDistrict]);

  useEffect(() => {
    if (!open || !addressCountryId || !addressState || !addressDistrict || !addressCity) {
      return;
    }

    loadAddressOptions("areas", {
      countryId: addressCountryId,
      stateId: addressState,
      districtId: addressDistrict,
      cityId: addressCity,
    });
  }, [open, addressCountryId, addressState, addressDistrict, addressCity]);

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setAddressError("Location is not supported by this browser.");
      return;
    }

    setAddressMode("gps");
    setAddressError("");

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const latitude = Number(coords.latitude);
        const longitude = Number(coords.longitude);
        setAddressLatitude(latitude);
        setAddressLongitude(longitude);

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            { headers: { Accept: "application/json" } }
          );

          if (!response.ok) {
            throw new Error("Unable to reverse geocode current location.");
          }

          const data = await response.json();
          const detectedAddress = data.display_name || `${latitude}, ${longitude}`;
          const detectedPincode = data.address?.postcode || "";
          setAddressFull(detectedAddress);
          setAddressPincode(detectedPincode);

          localStorage.setItem(
            "currentLocation",
            JSON.stringify({
              latitude,
              longitude,
              address: detectedAddress,
              pincode: detectedPincode,
              detectedAt: new Date().toISOString(),
            })
          );
        } catch (error) {
          console.warn("[ADDRESS MODAL] Reverse geocode failed:", error);
          setAddressFull(`${latitude}, ${longitude}`);
          setAddressPincode("");
        }
      },
      (locationError) => {
        console.error("[ADDRESS MODAL] Geo location failed:", locationError);
        setAddressError(
          locationError?.code === 1
            ? "Location permission is disabled. Please enable location access and try again."
            : "Unable to detect your current location. Please try again."
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
    );
  };

  const handleSave = async () => {
    const customer = readRegisteredCustomer();
    if (!customer?.uid) {
      setAddressError("Your session has expired. Please log in again.");
      return;
    }

    if (addressMode === "manual") {
      if (!addressCountryId || !addressState || !addressDistrict || !addressCity || !addressArea) {
        setAddressError("Please complete the location hierarchy before saving.");
        return;
      }
    }

    if (addressMode === "gps" && !addressFull.trim()) {
      setAddressError("Please wait for your current location to be detected.");
      return;
    }

    const nextAddress = {
      country: addressCountryId,
      state: addressState,
      district: addressDistrict,
      city: addressCity,
      area: addressArea,
      lat: addressMode === "gps" ? addressLatitude : null,
      lon: addressMode === "gps" ? addressLongitude : null,
      locationSource: addressMode === "gps" ? "gps" : "manual",
      address: addressMode === "gps"
        ? addressFull.trim()
        : [addressArea, addressCity, addressDistrict, addressState, addressCountryId]
            .filter(Boolean)
            .join(", "),
    };

    setIsSavingAddress(true);
    setAddressError("");

    try {
      await firebaseUpdateCustomer(customer.uid, { address: nextAddress });
      const updatedUser = { ...customer, address: nextAddress };
      localStorage.setItem("registeredUser", JSON.stringify(updatedUser));
      window.dispatchEvent(new Event("kadai-auth-changed"));
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
              onClick={() => {
                setAddressMode("gps");
                handleCurrentLocation();
              }}
              style={{
                border: addressMode === "gps" ? "1px solid #65a91a" : "1px solid #cbd5e1",
                background: addressMode === "gps" ? "#f7fbf3" : "#fff",
                color: "#356d1d",
                borderRadius: 8,
                padding: "10px 12px",
                cursor: "pointer",
              }}
            >
              Use Current Location
            </button>
            <button
              type="button"
              onClick={() => setAddressMode("manual")}
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

          {addressMode === "manual" && (
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

          {addressMode === "gps" && (
            <>
              <textarea
                value={addressFull}
                onChange={(event) => setAddressFull(event.target.value)}
                placeholder="Detected current address"
                rows={4}
                style={{ width: "100%", resize: "vertical", padding: 12, borderRadius: 8, border: "1px solid #d1d5db" }}
              />

              <input
                type="text"
                value={addressPincode}
                onChange={(event) => setAddressPincode(event.target.value)}
                placeholder="Pincode"
                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #d1d5db" }}
              />
            </>
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

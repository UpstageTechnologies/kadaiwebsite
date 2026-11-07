import { useEffect, useMemo, useState } from "react";
import { FiMapPin, FiSearch, FiX } from "react-icons/fi";
import {
  getRegistrationCountries,
  getRegistrationLocationOptions,
} from "../services/registration-location.service";
import "../index.css";

const emptyOptions = {
  countries: [],
  states: [],
  districts: [],
  cities: [],
  areas: [],
};

const getOptionLabel = (options, id) =>
  options.find((option) => option.id === id)?.label || "";

const LocationSelectionModal = ({
  open,
  onClose,
  onSelectLocation,
  location,
  status,
  error,
  requestLocation,
}) => {
  const [options, setOptions] = useState(emptyOptions);
  const [selected, setSelected] = useState({
    country: "",
    state: "",
    district: "",
    city: "",
    area: "",
  });
  const [search, setSearch] = useState("");
  const [manualError, setManualError] = useState("");
  const [gpsPending, setGpsPending] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;

    getRegistrationCountries()
      .then((countries) => {
        if (active) setOptions((current) => ({ ...current, countries }));
      })
      .catch((loadError) => {
        console.error("[LOCATION SELECTOR] Country load failed:", loadError);
        if (active) setManualError("Unable to load locations. Please try again.");
      });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !selected.country) return undefined;
    let active = true;

    getRegistrationLocationOptions({
      countryId: selected.country,
      level: "states",
    })
      .then((states) => {
        if (active) setOptions((current) => ({ ...current, states }));
      })
      .catch((loadError) => {
        console.error("[LOCATION SELECTOR] State load failed:", loadError);
        if (active) setManualError("Unable to load locations. Please try again.");
      });

    return () => {
      active = false;
    };
  }, [open, selected.country]);

  useEffect(() => {
    if (!open || !selected.country || !selected.state) return undefined;
    let active = true;

    getRegistrationLocationOptions({
      countryId: selected.country,
      stateId: selected.state,
      level: "districts",
    })
      .then((districts) => {
        if (active) setOptions((current) => ({ ...current, districts }));
      })
      .catch((loadError) => {
        console.error("[LOCATION SELECTOR] District load failed:", loadError);
        if (active) setManualError("Unable to load locations. Please try again.");
      });

    return () => {
      active = false;
    };
  }, [open, selected.country, selected.state]);

  useEffect(() => {
    if (!open || !selected.country || !selected.state || !selected.district) {
      return undefined;
    }
    let active = true;

    getRegistrationLocationOptions({
      countryId: selected.country,
      stateId: selected.state,
      districtId: selected.district,
      level: "cities",
    })
      .then((cities) => {
        if (active) setOptions((current) => ({ ...current, cities }));
      })
      .catch((loadError) => {
        console.error("[LOCATION SELECTOR] City load failed:", loadError);
        if (active) setManualError("Unable to load locations. Please try again.");
      });

    return () => {
      active = false;
    };
  }, [open, selected.country, selected.state, selected.district]);

  useEffect(() => {
    if (!open || !selected.country || !selected.state || !selected.district || !selected.city) {
      return undefined;
    }
    let active = true;

    getRegistrationLocationOptions({
      countryId: selected.country,
      stateId: selected.state,
      districtId: selected.district,
      cityId: selected.city,
      level: "areas",
    })
      .then((areas) => {
        if (active) setOptions((current) => ({ ...current, areas }));
      })
      .catch((loadError) => {
        console.error("[LOCATION SELECTOR] Area load failed:", loadError);
        if (active) setManualError("Unable to load locations. Please try again.");
      });

    return () => {
      active = false;
    };
  }, [
    open,
    selected.country,
    selected.state,
    selected.district,
    selected.city,
  ]);

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return options;
    return Object.fromEntries(
      Object.entries(options).map(([level, levelOptions]) => [
        level,
        levelOptions.filter((option) =>
          option.label.toLocaleLowerCase().includes(query)
        ),
      ])
    );
  }, [options, search]);

  if (!open) return null;

  const handleCurrentLocation = async () => {
    setGpsPending(true);
    setManualError("");
    const detectedLocation = await requestLocation();
    if (detectedLocation) onSelectLocation(detectedLocation);
    setGpsPending(false);
  };

  const handleSelectionChange = (level, value) => {
    setManualError("");
    setSelected((current) => {
      const next = { ...current, [level]: value };
      const levels = ["country", "state", "district", "city", "area"];
      const changedIndex = levels.indexOf(level);
      levels.slice(changedIndex + 1).forEach((childLevel) => {
        next[childLevel] = "";
      });
      return next;
    });

    const levelsToClear = {
      country: ["states", "districts", "cities", "areas"],
      state: ["districts", "cities", "areas"],
      district: ["cities", "areas"],
      city: ["areas"],
      area: [],
    };
    setOptions((current) => ({
      ...current,
      ...Object.fromEntries((levelsToClear[level] || []).map((key) => [key, []])),
    }));
  };

  const handleManualSelect = () => {
    const country = getOptionLabel(options.countries, selected.country);
    const state = getOptionLabel(options.states, selected.state);
    const district = getOptionLabel(options.districts, selected.district);
    const cityOption = options.cities.find((option) => option.id === selected.city);
    const areaOption = options.areas.find((option) => option.id === selected.area);

    if (!country || !state || !district || !cityOption || !areaOption) {
      setManualError("Select a country, state, district, city, and area.");
      return;
    }

    const parts = [
      areaOption.label,
      cityOption.label,
      district,
      state,
      country,
      areaOption.pincode,
    ].filter(Boolean);
    const fullAddress = [...new Set(parts)].join(", ");
    const coordinates = areaOption.lat != null && areaOption.lon != null
      ? { lat: areaOption.lat, lon: areaOption.lon }
      : cityOption.lat != null && cityOption.lon != null
        ? { lat: cityOption.lat, lon: cityOption.lon }
        : {};

    onSelectLocation({
      ...coordinates,
      country,
      countryCode: options.countries.find((option) => option.id === selected.country)?.code || "",
      state,
      district,
      city: cityOption.label,
      area: areaOption.label,
      pincode: areaOption.pincode || cityOption.pincode || "",
      fullAddress,
      formattedAddress: fullAddress,
      address: fullAddress,
      locationSource: "manual",
    });
  };

  const selectFields = [
    ["country", "Country", "countries"],
    ["state", "State", "states"],
    ["district", "District", "districts"],
    ["city", "City", "cities"],
    ["area", "Area", "areas"],
  ];

  return (
    <div
      className="location-selection-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="location-selection-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-selection-title"
      >
        <header className="location-selection-header">
          <div>
            <span className="location-selection-eyebrow">Delivery location</span>
            <h2 id="location-selection-title">Select delivery location</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close location selector">
            <FiX />
          </button>
        </header>

        <button
          type="button"
          className="location-current-button"
          disabled={gpsPending || status === "loading"}
          onClick={handleCurrentLocation}
        >
          <FiMapPin aria-hidden="true" />
          <span>
            <strong>{gpsPending || status === "loading" ? "Detecting location..." : "Use My Current Location"}</strong>
            <small>Allow location access to find nearby stores</small>
          </span>
        </button>

        {(error || manualError) && (
          <p className="location-selection-error" role="alert">
            {manualError || error} You can still choose your location manually.
          </p>
        )}

        <div className="location-selection-divider"><span>or choose manually</span></div>

        <label className="location-selection-search">
          <FiSearch aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search countries, cities, or areas"
          />
        </label>

        <div className="location-selection-fields">
          {selectFields.map(([level, label, optionsKey]) => (
            <label key={level}>
              <span>{label}</span>
              <select
                value={selected[level]}
                onChange={(event) => handleSelectionChange(level, event.target.value)}
                disabled={Boolean(
                  selectFields.findIndex(([field]) => field === level)
                  && !selected[selectFields[selectFields.findIndex(([field]) => field === level) - 1][0]]
                )}
              >
                <option value="">Select {label}</option>
                {filteredOptions[optionsKey].map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <footer className="location-selection-footer">
          {location && (
            <p>Current selection: {location.area || location.city || location.district || location.address}</p>
          )}
          <button type="button" onClick={handleManualSelect}>
            Set delivery location
          </button>
        </footer>
      </section>
    </div>
  );
};

export default LocationSelectionModal;

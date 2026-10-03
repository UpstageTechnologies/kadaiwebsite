import {
  getRegistrationCountries,
  getRegistrationLocationOptions,
} from "./registration-location.service";

const LOCATION_ERROR_CODES = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
};

const firstValue = (...values) => values.find((value) => String(value || "").trim()) || "";

const normalizeLabel = (value) => String(value || "")
  .trim()
  .toLocaleLowerCase()
  .replace(/\s+/g, " ");

const withDetectedOption = (options, value) => {
  if (!value || options.some((option) => normalizeLabel(option.label) === normalizeLabel(value))) {
    return options;
  }

  return [...options, { id: value, value, label: value }];
};

const findOption = (options, values) => {
  const labels = values.map(normalizeLabel).filter(Boolean);
  return options.find((option) => labels.includes(normalizeLabel(option.label)));
};

const getCoordinates = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error("Location is not supported by this browser."));
    return;
  }

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => resolve({
      latitude: Number(coords.latitude),
      longitude: Number(coords.longitude),
    }),
    (error) => {
      const message = error?.code === LOCATION_ERROR_CODES.PERMISSION_DENIED
        ? "Location permission is disabled. Please enable location access and try again."
        : error?.code === LOCATION_ERROR_CODES.POSITION_UNAVAILABLE
          ? "GPS/location is currently unavailable. Turn on location and try again."
          : error?.code === LOCATION_ERROR_CODES.TIMEOUT
            ? "Location request timed out. Please try again."
            : "Unable to detect your current location. Please try again.";
      reject(new Error(message));
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
  );
});

export const getCurrentLocationAddress = async () => {
  const coordinates = await getCoordinates();
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coordinates.latitude}&lon=${coordinates.longitude}`,
    { headers: { Accept: "application/json" } }
  );

  if (!response.ok) {
    throw new Error("Unable to reverse geocode current location.");
  }

  const data = await response.json();
  const parts = data.address || {};
  const house = firstValue(parts.house_number, parts.house_name, parts.building);
  const road = firstValue(parts.road, parts.pedestrian, parts.residential);
  const area = firstValue(
    parts.suburb,
    parts.neighbourhood,
    parts.quarter,
    parts.hamlet,
    parts.locality,
    parts.village
  );
  const city = firstValue(parts.city, parts.town, parts.municipality, parts.village);
  const district = firstValue(parts.state_district, parts.county, parts.district);
  const state = firstValue(parts.state);
  const country = firstValue(parts.country);
  const pincode = firstValue(parts.postcode);
  const normalizedAddress = {
    ...coordinates,
    house,
    road,
    area: area || road,
    pincode,
    city,
    district,
    country,
    state,
    fullAddress: [
      house,
      road,
      area,
      city,
      district,
      state,
      pincode,
    ].filter((value, index, values) => value && values.indexOf(value) === index).join(", ")
      || data.display_name
      || `${coordinates.latitude}, ${coordinates.longitude}`,
    locationSource: "gps",
  };

  const options = {
    countries: [],
    states: [],
    districts: [],
    cities: [],
    areas: [],
  };
  const matches = {
    country: null,
    state: null,
    district: null,
    city: null,
    area: null,
  };

  try {
    options.countries = await getRegistrationCountries();
    const countryOption = options.countries.find((option) =>
      (parts.country_code && option.code?.toLowerCase() === parts.country_code.toLowerCase())
      || normalizeLabel(option.label) === normalizeLabel(country)
    );
    matches.country = countryOption || null;

    if (countryOption) {
      options.states = await getRegistrationLocationOptions({
        countryId: countryOption.id,
        level: "states",
      });
      matches.state = findOption(options.states, [state]) || null;

      if (matches.state) {
        options.districts = await getRegistrationLocationOptions({
          countryId: countryOption.id,
          stateId: matches.state.id,
          level: "districts",
        });
        matches.district = findOption(options.districts, [district]) || null;

        if (matches.district) {
          options.cities = await getRegistrationLocationOptions({
            countryId: countryOption.id,
            stateId: matches.state.id,
            districtId: matches.district.id,
            level: "cities",
          });
          matches.city = findOption(options.cities, [city]) || null;

          if (matches.city) {
            options.areas = await getRegistrationLocationOptions({
              countryId: countryOption.id,
              stateId: matches.state.id,
              districtId: matches.district.id,
              cityId: matches.city.id,
              level: "areas",
            });
            matches.area = findOption(options.areas, [area, road]) || null;
          }
        }
      }
    }
  } catch (locationMasterError) {
    console.warn("[LOCATION] location_master match failed:", locationMasterError);
  }

  options.countries = withDetectedOption(options.countries, country);
  options.states = withDetectedOption(options.states, state);
  options.districts = withDetectedOption(options.districts, district);
  options.cities = withDetectedOption(options.cities, city);
  options.areas = withDetectedOption(options.areas, normalizedAddress.area);

  return { ...normalizedAddress, options, matches };
};

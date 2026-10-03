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

const findOption = (options, values) => {
  const labels = values.map(normalizeLabel).filter(Boolean);
  return options.find((option) => labels.includes(normalizeLabel(option.label)));
};

const getCoordinates = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error("Location is not supported by this browser."));
    return;
  }

  const onSuccess = ({ coords }) => resolve({
    latitude: Number(coords.latitude),
    longitude: Number(coords.longitude),
  });
  const requestLocation = (options, onError) => {
    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
  };

  requestLocation(
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    (highAccuracyError) => {
      if (highAccuracyError?.code === LOCATION_ERROR_CODES.PERMISSION_DENIED) {
        reject(new Error("Location permission is disabled. Please allow this site to access your location, then try again."));
        return;
      }

      if (
        highAccuracyError?.code !== LOCATION_ERROR_CODES.TIMEOUT
        && highAccuracyError?.code !== LOCATION_ERROR_CODES.POSITION_UNAVAILABLE
      ) {
        reject(new Error("Unable to detect your current location. Please try again."));
        return;
      }

      requestLocation(
        { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 },
        (fallbackError) => {
          const message = fallbackError?.code === LOCATION_ERROR_CODES.PERMISSION_DENIED
            ? "Location permission is disabled. Please allow this site to access your location, then try again."
            : fallbackError?.code === LOCATION_ERROR_CODES.TIMEOUT
              ? "Location request timed out after trying GPS and a standard location request. Please try again."
              : fallbackError?.code === LOCATION_ERROR_CODES.POSITION_UNAVAILABLE
                ? "Your location is currently unavailable. Check that location services are on and try again."
                : "Unable to detect your current location. Please try again.";
          reject(new Error(message));
        }
      );
    }
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
  const parts = data?.address || {};
  const house = firstValue(parts.house_number, parts["addr:housenumber"]);
  const building = firstValue(
    parts.building !== "yes" ? parts.building : "",
    parts.house_name,
    parts.building_name,
    parts["building:name"]
  );
  const flat = firstValue(
    parts.unit,
    parts.apartment,
    parts.door,
    parts.room,
    parts["addr:unit"],
    parts["addr:door"],
    parts["addr:flats"]
  );
  const road = firstValue(
    parts.road,
    parts.pedestrian,
    parts.residential,
    parts.street,
    parts.footway,
    parts.path
  );
  const area = firstValue(
    parts.suburb,
    parts.neighbourhood,
    parts.quarter,
    parts.city_district,
    parts.hamlet,
    parts.locality,
    parts.village
  );
  const landmark = firstValue(
    parts.amenity,
    parts.attraction,
    parts.shop,
    parts.tourism,
    parts.leisure,
    parts.historic,
    parts.office,
    parts.entrance
  );
  const village = firstValue(parts.village, parts.hamlet);
  const city = firstValue(parts.city, parts.town, parts.municipality, parts.village);
  const district = firstValue(parts.state_district, parts.county, parts.district);
  const state = firstValue(parts.state);
  const country = firstValue(parts.country);
  const pincode = firstValue(parts.postcode);
  const formattedAddress = firstValue(
    data?.display_name,
    [
      house,
      building,
      flat,
      road,
      area,
      village,
      city,
      district,
      state,
      country,
      pincode,
    ].filter((value, index, values) => value && values.indexOf(value) === index).join(", ")
  );
  const normalizedAddress = {
    ...coordinates,
    house,
    building,
    flat,
    road,
    area,
    landmark,
    village,
    pincode,
    city,
    district,
    country,
    state,
    formattedAddress,
    fullAddress: formattedAddress,
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

  return { ...normalizedAddress, options, matches };
};

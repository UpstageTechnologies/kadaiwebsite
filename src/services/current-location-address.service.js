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

const normalizeGeocodingLabel = (value) => normalizeLabel(value)
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .replace(/[^\p{L}\p{N}]+/gu, "")
  .trim();

const labelsMatch = (expected, candidate) => {
  const normalizedExpected = normalizeGeocodingLabel(expected);
  const normalizedCandidate = normalizeGeocodingLabel(candidate);
  if (!normalizedExpected || !normalizedCandidate) return false;
  if (normalizedExpected === normalizedCandidate) return true;
  if (normalizedExpected.length < 8 || normalizedCandidate.length < 8) return false;

  let previousRow = Array.from(
    { length: normalizedCandidate.length + 1 },
    (_, index) => index
  );
  for (let expectedIndex = 1; expectedIndex <= normalizedExpected.length; expectedIndex += 1) {
    const currentRow = [expectedIndex];
    for (let candidateIndex = 1; candidateIndex <= normalizedCandidate.length; candidateIndex += 1) {
      currentRow[candidateIndex] = Math.min(
        currentRow[candidateIndex - 1] + 1,
        previousRow[candidateIndex] + 1,
        previousRow[candidateIndex - 1]
          + (normalizedExpected[expectedIndex - 1] === normalizedCandidate[candidateIndex - 1] ? 0 : 1)
      );
    }
    previousRow = currentRow;
  }

  const similarity = 1 - previousRow[normalizedCandidate.length]
    / Math.max(normalizedExpected.length, normalizedCandidate.length);
  return similarity >= 0.83;
};

const matchesGeocodingLabel = (expected, candidates) => candidates.some(
  (candidate) => labelsMatch(expected, candidate)
);

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

export const getManualAddressCoordinates = async ({
  country,
  state,
  district,
  city,
}) => {
  if (![country, state, district, city].every((value) => String(value || "").trim())) {
    throw new Error("Please select a City, District, State, and Country before locating this address.");
  }

  const queryParts = [city, district]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  const searchUrl = new URL("https://nominatim.openstreetmap.org/search");
  searchUrl.searchParams.set("format", "jsonv2");
  searchUrl.searchParams.set("addressdetails", "1");
  searchUrl.searchParams.set("limit", "5");
  searchUrl.searchParams.set("q", queryParts.join(", "));

  const response = await fetch(searchUrl, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("We couldn't look up this address. Please try again.");
  }

  const results = await response.json();
  const matchingResult = (Array.isArray(results) ? results : []).find((result) => {
    const address = result?.address || {};
    const districtMatches = matchesGeocodingLabel(district, [
      address.state_district,
      address.county,
      address.district,
    ]);
    const cityMatches = matchesGeocodingLabel(city, [
      address.city,
      address.town,
      address.village,
      address.municipality,
      address.hamlet,
      address.locality,
      address.city_district,
    ]);
    return districtMatches && cityMatches;
  }) || null;

  if (!matchingResult) {
    throw new Error(
      "We couldn't reliably locate this address. Check the selected City and District, then try again."
    );
  }

  const latitude = Number(matchingResult.lat);
  const longitude = Number(matchingResult.lon);
  if (
    !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) {
    throw new Error("The address lookup returned invalid coordinates. Please try again.");
  }

  return { lat: latitude, lon: longitude };
};

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
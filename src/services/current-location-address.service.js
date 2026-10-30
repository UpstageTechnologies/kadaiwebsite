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

export const CITY_COORDINATES = {
  sattur: { lat: 9.3639, lon: 77.9254, state: "Tamil Nadu", district: "Virudhunagar", country: "India" },
  padanthal: { lat: 9.3565, lon: 77.9250, state: "Tamil Nadu", district: "Virudhunagar", country: "India" },
  virudhunagar: { lat: 9.5680, lon: 77.9624, state: "Tamil Nadu", district: "Virudhunagar", country: "India" },
  sivakasi: { lat: 9.4533, lon: 77.7947, state: "Tamil Nadu", district: "Virudhunagar", country: "India" },
  aruppukkottai: { lat: 9.5103, lon: 78.0984, state: "Tamil Nadu", district: "Virudhunagar", country: "India" },
  rajapalayam: { lat: 9.4532, lon: 77.5540, state: "Tamil Nadu", district: "Virudhunagar", country: "India" },
  srivilliputhur: { lat: 9.5107, lon: 77.6322, state: "Tamil Nadu", district: "Virudhunagar", country: "India" },
  kovilpatti: { lat: 9.1729, lon: 77.8687, state: "Tamil Nadu", district: "Thoothukudi", country: "India" },
  chennai: { lat: 13.0827, lon: 80.2707, state: "Tamil Nadu", district: "Chennai", country: "India" },
  madurai: { lat: 9.9252, lon: 78.1198, state: "Tamil Nadu", district: "Madurai", country: "India" },
  coimbatore: { lat: 11.0168, lon: 76.9558, state: "Tamil Nadu", district: "Coimbatore", country: "India" },
  trichy: { lat: 10.7905, lon: 78.7047, state: "Tamil Nadu", district: "Tiruchirappalli", country: "India" },
  tiruchirappalli: { lat: 10.7905, lon: 78.7047, state: "Tamil Nadu", district: "Tiruchirappalli", country: "India" },
  salem: { lat: 11.6643, lon: 78.1460, state: "Tamil Nadu", district: "Salem", country: "India" },
  tirunelveli: { lat: 8.7139, lon: 77.7567, state: "Tamil Nadu", district: "Tirunelveli", country: "India" },
  erode: { lat: 11.3410, lon: 77.7172, state: "Tamil Nadu", district: "Erode", country: "India" },
  tiruppur: { lat: 11.1085, lon: 77.3411, state: "Tamil Nadu", district: "Tiruppur", country: "India" },
  thanjavur: { lat: 10.7870, lon: 79.1378, state: "Tamil Nadu", district: "Thanjavur", country: "India" },
  dindigul: { lat: 10.3673, lon: 77.9803, state: "Tamil Nadu", district: "Dindigul", country: "India" },
  vellore: { lat: 12.9165, lon: 79.1325, state: "Tamil Nadu", district: "Vellore", country: "India" },
  thoothukudi: { lat: 8.7642, lon: 78.1348, state: "Tamil Nadu", district: "Thoothukudi", country: "India" },
  tuticorin: { lat: 8.7642, lon: 78.1348, state: "Tamil Nadu", district: "Thoothukudi", country: "India" },
  nagercoil: { lat: 8.1833, lon: 77.4119, state: "Tamil Nadu", district: "Kanyakumari", country: "India" },
  kanchipuram: { lat: 12.8342, lon: 79.7036, state: "Tamil Nadu", district: "Kanchipuram", country: "India" },
};

export const CITY_POPULAR_AREAS = {
  sattur: {
    padanthal: { lat: 9.3565, lon: 77.9250 },
    virudhunagar: { lat: 9.5680, lon: 77.9624 },
    sivakasi: { lat: 9.4533, lon: 77.7947 },
  },
  virudhunagar: {
    padiyapatti: { lat: 9.5271, lon: 77.9586 },
    kumbakonam: { lat: 10.9594, lon: 79.3804 },
  },
  chennai: {
    adyar: { lat: 13.0068, lon: 80.2568 },
    tambaram: { lat: 12.9249, lon: 80.1282 },
  },
  madurai: {
    alagarKoil: { lat: 9.9503, lon: 78.2227 },
    thirumangalam: { lat: 9.8136, lon: 78.0013 },
  },
  coimbatore: {
    gandhipuram: { lat: 11.0169, lon: 76.9551 },
    peelamedu: { lat: 11.0436, lon: 76.9762 },
  },
};

export const normalizeAddressPayload = (address = {}) => ({
  country: String(address.country || "").trim(),
  countryCode: String(address.countryCode || "").trim(),
  state: String(address.state || "").trim(),
  district: String(address.district || "").trim(),
  city: String(address.city || "").trim(),
  area: String(address.area || "").trim(),
  pincode: String(address.pincode || "").trim(),
});

const matchesMappedLocation = (address, mappedLocation) => {
  if (!address.state || !labelsMatch(address.state, mappedLocation.state)) {
    return false;
  }

  const countryValues = [address.country, address.countryCode]
    .map(normalizeGeocodingLabel)
    .filter(Boolean);
  const mappedCountry = normalizeGeocodingLabel(mappedLocation.country);
  if (
    countryValues.length
    && !countryValues.some((value) =>
      value === mappedCountry || (value === "in" && mappedCountry === "india")
    )
  ) {
    return false;
  }

  return !address.district || labelsMatch(address.district, mappedLocation.district);
};

const resolveKnownLocationCoordinates = (address) => {
  const cityKey = normalizeGeocodingLabel(address.city);
  const districtKey = normalizeGeocodingLabel(address.district);
  const areaKey = normalizeGeocodingLabel(address.area);
  const cityEntry = Object.entries(CITY_COORDINATES)
    .find(([key]) => normalizeGeocodingLabel(key) === cityKey);

  if (cityEntry) {
    const [, mappedLocation] = cityEntry;
    if (!matchesMappedLocation(address, mappedLocation)) {
      return null;
    }

    const areaCoordinates = Object.entries(CITY_POPULAR_AREAS[cityEntry[0]] || {})
      .find(([key]) => normalizeGeocodingLabel(key) === areaKey)?.[1];
    return areaCoordinates || mappedLocation;
  }

  const districtEntry = Object.entries(CITY_COORDINATES).find(([key, mappedLocation]) =>
    normalizeGeocodingLabel(key) === districtKey
    && normalizeGeocodingLabel(mappedLocation.district) === districtKey
    && matchesMappedLocation(address, mappedLocation)
  );
  return districtEntry?.[1] || null;
};

export const resolveAreaCoordinates = (locationData = {}) => {
  const normalizedAddress = normalizeAddressPayload(locationData);
  const result = resolveKnownLocationCoordinates(normalizedAddress);
  if (!result) {
    return null;
  }

  if (
    !Number.isFinite(result.lat)
    || !Number.isFinite(result.lon)
    || result.lat < -90
    || result.lat > 90
    || result.lon < -180
    || result.lon > 180
  ) {
    return null;
  }

  return { lat: result.lat, lon: result.lon };
};

export const forwardGeocodeAddress = async ({
  country,
  state,
  district,
  city,
  area,
  pincode,
}) => {
  const queryParts = [area, city, district, state, country, pincode]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  if (!queryParts.length) {
    return null;
  }

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
    const districtMatches = matchesGeocodingLabel(district || city || state, [
      address.state_district,
      address.county,
      address.district,
    ]);
    const cityMatches = matchesGeocodingLabel(city || district || state, [
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
    return null;
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
    return null;
  }

  return { lat: latitude, lon: longitude };
};

export const reverseGeocodeLocation = async (lat, lon) => {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    return null;
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(Number(lat))}&lon=${encodeURIComponent(Number(lon))}&addressdetails=1&zoom=18`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "KadaiApp/1.0",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to reverse geocode this location.");
  }

  const payload = await response.json();
  if (!payload || payload.error) {
    throw new Error(payload?.error || "Unable to resolve the address for this location.");
  }

  return payload;
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
  area,
}) => {
  if (![country, state, district, city].every((value) => String(value || "").trim())) {
    throw new Error("Please select a City, District, State, and Country before locating this address.");
  }

  const knownCoordinates = resolveAreaCoordinates({ country, state, district, city, area });
  if (knownCoordinates) {
    return knownCoordinates;
  }

  const geocodedCoordinates = await forwardGeocodeAddress({
    country,
    state,
    district,
    city,
    area,
  });
  if (geocodedCoordinates) {
    return geocodedCoordinates;
  }

  throw new Error(
    "We couldn't reliably locate this address. Check the selected City and District, then try again."
  );
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
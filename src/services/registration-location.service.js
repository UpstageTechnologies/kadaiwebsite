import { collection, getDocs } from "firebase/firestore";

import { BASE_LOCATION_HIERARCHY } from "./current-location-address.service";
import { db } from "./firebase";

const parseCoordinate = (value) => {
  if (
    (typeof value !== "number" && typeof value !== "string")
    || (typeof value === "string" && !value.trim())
  ) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getLocationCoordinates = (data) => {
  const sources = [
    data?.coordinates,
    data?.location,
    data,
  ].filter((source) => source && typeof source === "object");

  for (const source of sources) {
    const lat = parseCoordinate(source.lat ?? source.latitude);
    const lon = parseCoordinate(source.lon ?? source.lng ?? source.longitude);
    if (
      lat !== null
      && lon !== null
      && lat >= -90
      && lat <= 90
      && lon >= -180
      && lon <= 180
    ) {
      return { lat, lon };
    }
  }

  return null;
};

const mapLocationOptions = (snapshot, fallbackFields) => snapshot.docs
  .map((locationSnapshot) => {
    const data = locationSnapshot.data() || {};
    const value = String(
      data.name || fallbackFields.map((field) => data[field]).find(Boolean) || locationSnapshot.id
    ).trim();
    const coordinates = getLocationCoordinates(data);

    return value
      ? {
        id: locationSnapshot.id,
        value,
        label: value,
        ...(coordinates || {}),
      }
      : null;
  })
  .filter(Boolean)
  .sort((first, second) => first.label.localeCompare(second.label));

const normalizeHierarchyToken = (value) => String(value ?? "").trim().toLowerCase();

const findHierarchyMatch = (entries, token) => {
  const normalizedToken = normalizeHierarchyToken(token);
  if (!normalizedToken || !entries || typeof entries !== "object") {
    return null;
  }

  const matchEntry = Object.entries(entries).find(([entryKey, entryValue]) => {
    const entryId = String(entryValue?.id || entryKey || "").trim();
    const entryName = String(entryValue?.name || entryKey || "").trim();
    return [entryKey, entryId, entryName].some(
      (candidate) => normalizeHierarchyToken(candidate) === normalizedToken
    );
  });

  return matchEntry ? matchEntry[1] : null;
};

const getHierarchyCountryEntries = () => Object.entries(BASE_LOCATION_HIERARCHY || {})
  .map(([countryKey, countryValue]) => ({
    id: String(countryValue?.id || countryKey),
    value: String(countryValue?.id || countryKey),
    label: String(countryValue?.name || countryKey),
    code: String(countryValue?.code || ""),
  }))
  .sort((first, second) => first.label.localeCompare(second.label));

const getHierarchyOptionsForLevel = ({ countryId, stateId, districtId, cityId, level }) => {
  const hierarchy = BASE_LOCATION_HIERARCHY || {};
  const countryEntry = findHierarchyMatch(hierarchy, countryId)
    || (countryId && hierarchy[countryId])
    || null;

  if (!countryEntry) {
    return [];
  }

  const stateEntries = countryEntry.states || {};

  switch (level) {
    case "states": {
      return Object.entries(stateEntries).map(([stateKey, stateValue]) => ({
        id: String(stateValue?.id || stateKey),
        value: String(stateValue?.name || stateKey),
        label: String(stateValue?.name || stateKey),
      })).sort((first, second) => first.label.localeCompare(second.label));
    }
    case "districts": {
      const matchedState = findHierarchyMatch(stateEntries, stateId) || (stateId && stateEntries[stateId]) || null;
      const districtEntries = matchedState?.districts || {};
      return Object.entries(districtEntries).map(([districtKey, districtValue]) => ({
        id: String(districtValue?.id || districtKey),
        value: String(districtValue?.name || districtKey),
        label: String(districtValue?.name || districtKey),
      })).sort((first, second) => first.label.localeCompare(second.label));
    }
    case "cities": {
      const matchedState = findHierarchyMatch(stateEntries, stateId) || (stateId && stateEntries[stateId]) || null;
      const districtEntries = matchedState?.districts || {};
      const matchedDistrict = findHierarchyMatch(districtEntries, districtId) || (districtId && districtEntries[districtId]) || null;
      const cityEntries = matchedDistrict?.cities || {};
      return Object.entries(cityEntries).map(([cityKey, cityValue]) => ({
        id: String(cityValue?.id || cityKey),
        value: String(cityValue?.name || cityKey),
        label: String(cityValue?.name || cityKey),
        lat: cityValue?.lat ?? null,
        lon: cityValue?.lon ?? null,
        pincode: cityValue?.pincode || "",
      })).sort((first, second) => first.label.localeCompare(second.label));
    }
    case "areas": {
      const matchedState = findHierarchyMatch(stateEntries, stateId) || (stateId && stateEntries[stateId]) || null;
      const districtEntries = matchedState?.districts || {};
      const matchedDistrict = findHierarchyMatch(districtEntries, districtId) || (districtId && districtEntries[districtId]) || null;
      const cityEntries = matchedDistrict?.cities || {};
      const matchedCity = findHierarchyMatch(cityEntries, cityId) || (cityId && cityEntries[cityId]) || null;
      const streetEntries = matchedCity?.streets || [];
      return streetEntries.map((street) => ({
        id: String(street?.name || ""),
        value: String(street?.name || ""),
        label: String(street?.name || ""),
        lat: street?.lat ?? null,
        lon: street?.lon ?? null,
        pincode: street?.pincode || "",
        isStore: Boolean(street?.isStore),
      })).filter((entry) => entry.id).sort((first, second) => first.label.localeCompare(second.label));
    }
    default:
      return [];
  }
};

const mapCountryOptions = (snapshot) => snapshot.docs
  .map((locationSnapshot) => {
    const data = locationSnapshot.data() || {};
    const value = String(data.name || locationSnapshot.id).trim();

    if (data.isActive === false || !value) return null;

    return {
      id: locationSnapshot.id,
      value: locationSnapshot.id,
      label: value,
      code: String(data.code || "").trim(),
    };
  })
  .filter(Boolean)
  .sort((first, second) => first.label.localeCompare(second.label));

const getLocationCollection = (countryId, stateId, districtId, cityId, child) => {
  const path = ["location_master", countryId];

  if (child === "states") return collection(db, ...path, "states");
  path.push("states", stateId);
  if (child === "districts") return collection(db, ...path, "districts");
  path.push("districts", districtId);
  if (child === "cities") return collection(db, ...path, "cities");
  path.push("cities", cityId);
  return collection(db, ...path, "areas");
};

export const getRegistrationLocationOptions = async ({
  countryId,
  stateId,
  districtId,
  cityId,
  level,
}) => {
  if (!db || !countryId || (level !== "states" && !stateId) || (level === "cities" && !districtId) || (level === "areas" && !cityId)) {
    return [];
  }

  const fieldsByLevel = {
    states: ["state"],
    districts: ["district"],
    cities: ["city"],
    areas: ["area"],
  };
  const snapshot = await getDocs(
    getLocationCollection(countryId, stateId, districtId, cityId, level)
  );

  return mapLocationOptions(snapshot, fieldsByLevel[level] || []);
};

export const getRegistrationCountries = async () => {
  if (!db) return [];

  const snapshot = await getDocs(collection(db, "location_master"));
  return mapCountryOptions(snapshot);
};
import { collection, getDocs } from "firebase/firestore";

import { db } from "./firebase";

const getLocationCoordinates = (data) => {
  const sources = [
    data?.coordinates,
    data?.location,
    data,
  ].filter((source) => source && typeof source === "object");

  for (const source of sources) {
    const lat = Number(source.lat ?? source.latitude);
    const lon = Number(source.lon ?? source.lng ?? source.longitude);
    if (
      Number.isFinite(lat)
      && Number.isFinite(lon)
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
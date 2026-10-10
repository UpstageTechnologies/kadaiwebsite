import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import { db } from "./firebase";

const mapLocationOptions = (snapshot, fallbackFields) => snapshot.docs
  .map((locationSnapshot) => {
    const data = locationSnapshot.data() || {};
    const value = String(
      data.name || fallbackFields.map((field) => data[field]).find(Boolean) || locationSnapshot.id
    ).trim();

    return value
      ? { id: locationSnapshot.id, value, label: value }
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

export const getRegistrationLocationCoordinates = async ({
  countryId,
  stateId,
  districtId,
  cityId,
  areaId,
}) => {
  if (!db) {
    throw new Error("Firebase Firestore is unavailable. Please try again.");
  }

  if (!countryId || !stateId || !districtId || !cityId || !areaId) {
    throw new Error("Please select Country, State, District, City, and Area.");
  }

  const areaRef = doc(
    db,
    "location_master",
    countryId,
    "states",
    stateId,
    "districts",
    districtId,
    "cities",
    cityId,
    "areas",
    areaId
  );
  const areaSnapshot = await getDoc(areaRef);

  if (!areaSnapshot.exists()) {
    throw new Error("The selected area could not be found. Please select it again.");
  }

  const areaData = areaSnapshot.data() || {};
  const parseCoordinate = (value) => {
    if (
      (typeof value !== "number" && typeof value !== "string")
      || (typeof value === "string" && !value.trim())
    ) {
      return null;
    }

    const coordinate = Number(value);
    return Number.isFinite(coordinate) ? coordinate : null;
  };
  const latitude = parseCoordinate(areaData.latitude ?? areaData.lat);
  const longitude = parseCoordinate(areaData.longitude ?? areaData.lon ?? areaData.lng);

  if (
    latitude === null
    || longitude === null
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) {
    throw new Error("Coordinates are not available for the selected area. Please select another area.");
  }

  return { latitude, longitude };
};

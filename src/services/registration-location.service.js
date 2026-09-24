import { collection, getDocs } from "firebase/firestore";

import { db } from "./firebase";

const mapLocationOptions = (snapshot, fallbackField) => snapshot.docs
  .map((locationSnapshot) => {
    const data = locationSnapshot.data() || {};
    const value = String(data.name || data[fallbackField] || locationSnapshot.id).trim();

    return value
      ? { id: locationSnapshot.id, value, label: value }
      : null;
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

  const fieldByLevel = {
    states: "state",
    districts: "district",
    cities: "city",
    areas: "area",
  };
  const snapshot = await getDocs(
    getLocationCollection(countryId, stateId, districtId, cityId, level)
  );

  return mapLocationOptions(snapshot, fieldByLevel[level]);
};

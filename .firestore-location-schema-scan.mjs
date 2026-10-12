import { loadEnv } from "vite";
import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore } from "firebase/firestore";

const env = loadEnv("development", process.cwd(), "VITE_");
const required = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];
const missing = required.filter((key) => !env[key]);
if (missing.length) {
  console.log(JSON.stringify({ configured: false, missing }));
  process.exit(0);
}

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);
const coordinateFields = new Set(["lat", "lon", "latitude", "longitude", "coordinates", "location"]);
const inspected = [];
const childCollections = ["states", "districts", "cities", "areas"];

const scan = async (path, depth) => {
  const snapshot = await getDocs(collection(db, ...path));
  for (const document of snapshot.docs) {
    const data = document.data() || {};
    inspected.push({
      level: depth,
      coordinateFields: Object.keys(data).filter((field) => coordinateFields.has(field)),
    });
    if (depth < childCollections.length) {
      await scan([...path, document.id, childCollections[depth]], depth + 1);
    }
  }
};

try {
  await scan(["location_master"], 0);
  const counts = inspected.reduce((result, item) => {
    const level = String(item.level);
    result[level] = (result[level] || 0) + 1;
    if (item.coordinateFields.length) {
      const key = `${level}WithCoordinateFields`;
      result[key] = (result[key] || 0) + 1;
    }
    return result;
  }, {});
  console.log(JSON.stringify({
    configured: true,
    inspectedDocuments: inspected.length,
    documentCountsByLevel: counts,
    coordinateFieldNamesPresent: [...new Set(inspected.flatMap((item) => item.coordinateFields))],
  }));
} catch (error) {
  console.log(JSON.stringify({
    configured: true,
    inspection: "failed",
    code: error?.code || "unknown",
    message: error?.code === "permission-denied"
      ? "Firestore rules denied the read."
      : error?.message || "Firestore read failed.",
  }));
  process.exitCode = 1;
}

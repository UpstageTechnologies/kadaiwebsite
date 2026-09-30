import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "./firebase";

export const MARKET_MODES = {
  LOCAL: "local",
  GLOBAL: "global",
};

export const DEFAULT_MARKET_MODE = MARKET_MODES.LOCAL;
export const NEARBY_DISTANCE_KM = 3;

const fallbackImage =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80";

export const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const safeText = (value, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

export const extractSellerIdFromDocPath = (docPath = "") => {
  const segments = String(docPath || "").split("/").filter(Boolean);
  return segments[1] || "";
};

export const getCurrentCustomerUid = () => {
  return auth?.currentUser?.uid || "";
};

export const sanitizeLatLon = (value, fallback = null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
};

export const getAddressCoordinates = (source = {}) => {
  const address = source?.address ?? source ?? {};
  const lat = sanitizeLatLon(address?.lat ?? address?.latitude, null);
  const lon = sanitizeLatLon(address?.lon ?? address?.lng ?? address?.longitude, null);

  if (lat === null || lon === null) {
    return null;
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }

  return { lat, lon };
};

export const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadiusKm = 6371;
  const toRadians = (degree) => (degree * Math.PI) / 180;

  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const startLat = toRadians(lat1);
  const endLat = toRadians(lat2);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(startLat) *
      Math.cos(endLat) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

let marketplaceCatalog = [];

export const getMarketplaceCatalog = () => marketplaceCatalog;
export const setMarketplaceCatalog = (products = []) => {
  marketplaceCatalog = Array.isArray(products) ? products : [];
  return marketplaceCatalog;
};

const sellerNameCache = new Map();

const resolveSellerDisplayName = async (sellerId, fallbackName = "") => {
  if (!sellerId || !db) {
    return safeText(fallbackName, "Store");
  }

  if (sellerNameCache.has(sellerId)) {
    return sellerNameCache.get(sellerId);
  }

  try {
    const sellerSnapshot = await getDoc(doc(db, "users", sellerId));
    const sellerData = sellerSnapshot.data() || {};
    const resolvedName = safeText(
      sellerData.shopName || sellerData.storeName || sellerData.name || fallbackName,
      "Store"
    );

    sellerNameCache.set(sellerId, resolvedName);
    return resolvedName;
  } catch (error) {
    console.error("[MARKET] Seller lookup failed:", error);
    const fallback = safeText(fallbackName, "Store");
    sellerNameCache.set(sellerId, fallback);
    return fallback;
  }
};

export const mapFirestoreProduct = async (productSnapshot, marketType = MARKET_MODES.LOCAL) => {
  if (!productSnapshot || !productSnapshot.data) {
    return null;
  }

  const data = productSnapshot.data() || {};
  const shopId = extractSellerIdFromDocPath(productSnapshot.ref?.path || "");
  const itemName = safeText(data.itemName || data.name || "Product");
  const category = safeText(data.category || "General", "General");
  const price = normalizeNumber(data.salesPrice ?? data.price ?? 0, 0);
  const oldPrice = normalizeNumber(data.oldPrice ?? data.mrp ?? data.salesPrice ?? data.price ?? price, price);
  const quantity = normalizeNumber(data.quantity ?? 0, 0);
  const itemNo = safeText(data.itemNo || "");
  const productShopName = safeText(data.shopName || data.storeName || "", "");
  const finalSellerName =
    productShopName || (await resolveSellerDisplayName(shopId, "Store"));

  return {
    id: String(productSnapshot.id || data.id || `${shopId}-${itemNo || itemName}`),
    shopId,
    sellerId: shopId,
    itemNo,
    name: itemName,
    description: safeText(data.description || data.itemDescription || "Fresh product from local store", "Fresh product from local store"),
    price,
    oldPrice,
    rating: normalizeNumber(data.rating || 4.5, 4.5),
    unit: safeText(data.unit || data.packaging || data.size || "1 item", "1 item"),
    image: safeText(data.image || data.img || data.photo || fallbackImage, fallbackImage),
    quantity,
    category,
    shopName: finalSellerName,
    marketType,
  };
};

export const getNearbySellerIds = (customerLocation, sellerLocationMap = {}) => {
  if (!customerLocation || !customerLocation.lat || !customerLocation.lon) {
    return [];
  }

  return Object.entries(sellerLocationMap)
    .filter(([sellerId, sellerLocation]) => {
      if (!sellerLocation || !sellerLocation.lat || !sellerLocation.lon) {
        return false;
      }

      const distanceKm = haversineDistanceKm(
        customerLocation.lat,
        customerLocation.lon,
        sellerLocation.lat,
        sellerLocation.lon
      );

      return Number.isFinite(distanceKm) && distanceKm <= NEARBY_DISTANCE_KM;
    })
    .map(([sellerId]) => sellerId);
};

export const subscribeMarketplaceProducts = ({
  marketMode = DEFAULT_MARKET_MODE,
  onProducts,
  onError,
}) => {
  if (!db) {
    if (typeof onProducts === "function") {
      onProducts([]);
    }
    return () => {};
  }

  const collectionName = marketMode === MARKET_MODES.GLOBAL ? "global_inventory" : "inventory";

  const unsubscribe = onSnapshot(
    collectionGroup(db, collectionName),
    async (snapshot) => {
      try {
        const products = await Promise.all(
          snapshot.docs.map((documentSnapshot) => mapFirestoreProduct(documentSnapshot, marketMode))
        );

        const catalog = products.filter(Boolean);
        setMarketplaceCatalog(catalog);

        if (typeof onProducts === "function") {
          onProducts(catalog);
        }
      } catch (error) {
        console.error("[MARKET] Product stream failed:", error);
        if (typeof onError === "function") {
          onError(error);
        }
        if (typeof onProducts === "function") {
          onProducts([]);
        }
      }
    },
    (error) => {
      console.error("[MARKET] Firestore listener error:", error);
      if (typeof onError === "function") {
        onError(error);
      }
      if (typeof onProducts === "function") {
        onProducts([]);
      }
    }
  );

  return unsubscribe;
};

export const subscribeSellerLocations = ({ onLocations, onError }) => {
  if (!db) {
    if (typeof onLocations === "function") {
      onLocations({});
    }
    return () => {};
  }

  const sellersQuery = query(collection(db, "users"), where("role", "==", "seller"));

  const unsubscribe = onSnapshot(
    sellersQuery,
    (snapshot) => {
      const sellerLocations = {};

      snapshot.docs.forEach((documentSnapshot) => {
        const sellerData = documentSnapshot.data() || {};
        const coordinates = getAddressCoordinates(sellerData);

        if (coordinates) {
          sellerLocations[documentSnapshot.id] = coordinates;
        }
      });

      if (typeof onLocations === "function") {
        onLocations(sellerLocations);
      }
    },
    (error) => {
      console.error("[MARKET] Seller listener failed:", error);
      if (typeof onError === "function") {
        onError(error);
      }
      if (typeof onLocations === "function") {
        onLocations({});
      }
    }
  );

  return unsubscribe;
};

import{
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
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

const logMarketplaceDiagnostic = (...values) => {
  if (import.meta.env.DEV) {
    console.debug(...values);
  }
};

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

export const fetchAvailableStoreLocations = async () => {
  if (!db) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const sellersQuery = query(collection(db, "users"), where("role", "==", "seller"));
  const snapshot = await getDocs(sellersQuery);
  return snapshot.docs.map((sellerDoc) => {
    const sellerData = sellerDoc.data() || {};
    return {
      id: sellerDoc.id,
      ...sellerData,
      coordinates: getSellerCoordinates(sellerData),
    };
  });
}

export const getCachedLocation = (storageKey = "kadai_active_location") => {
  try {
    if (typeof window === "undefined") return null;
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) return null;
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
};

export const saveActiveLocation = (location, storageKey = "kadai_active_location") => {
  if (!location || typeof location !== "object") {
    return null;
  }

  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(location));
    }
  } catch {
    // Ignore storage issues.
  }

  return location;
};

export const fetchUserSavedAddresses = (customer = []) => {
  if (Array.isArray(customer)) {
    return customer.filter(Boolean);
  }

  if (!customer || typeof customer !== "object") {
    return [];
  }

  const addresses = Array.isArray(customer.addresses) ? customer.addresses : [];
  const fallbackAddress = customer.address ? [customer.address] : [];
  return [...addresses, ...fallbackAddress].filter(Boolean);
};

export const detectUserLocation = async () => {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Location is not supported by this browser.");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
};

export const sanitizeLatLon = (value, fallback = null) => {
  if (
    (typeof value !== "number" && typeof value !== "string")
    || (typeof value === "string" && !value.trim())
  ) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
};

const getCoordinateSourceCandidates = (source = {}) => {
  const nestedFields = [
    "address",
    "coordinates",
    "location",
    "coords",
    "shopAddress",
    "storeAddress",
    "shopLocation",
    "storeLocation",
    "shopCoordinates",
    "storeCoordinates",
    "geoPoint",
  ];
  const candidates = [];
  const queue = [source];
  const visited = new Set();

  while (queue.length) {
    const candidate = queue.shift();
    if (
      !candidate
      || typeof candidate !== "object"
      || Array.isArray(candidate)
      || visited.has(candidate)
    ) {
      continue;
    }

    visited.add(candidate);
    candidates.push(candidate);
    nestedFields.forEach((field) => {
      const nested = candidate[field];
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        queue.push(nested);
      }
    });
  }

  return candidates;
};

const extractCoordinatePair = (source = {}) => {
  const candidates = getCoordinateSourceCandidates(source);

  for (const candidate of candidates) {
    const lat = sanitizeLatLon(
      candidate?.lat
        ?? candidate?.latitude
        ?? candidate?.coordinates?.lat
        ?? candidate?.coordinates?.latitude
        ?? candidate?.location?.lat
        ?? candidate?.location?.latitude,
      null
    );
    const lon = sanitizeLatLon(
      candidate?.lon
        ?? candidate?.lng
        ?? candidate?.longitude
        ?? candidate?.coordinates?.lon
        ?? candidate?.coordinates?.lng
        ?? candidate?.coordinates?.longitude
        ?? candidate?.location?.lon
        ?? candidate?.location?.lng
        ?? candidate?.location?.longitude,
      null
    );

    if (lat === null || lon === null) {
      continue;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      continue;
    }

    return { lat, lon };
  }

  return null;
};

export const getAddressCoordinates = (source = {}) => extractCoordinatePair(source);

export const getMarketplaceCoordinates = (source = {}) => extractCoordinatePair(source);

export const getCustomerActiveLocation = (customer = {}) => {
  if (!customer || typeof customer !== "object") {
    return null;
  }

  const activeAddress = customer.address
    || customer.activeAddress
    || customer.selectedAddress;
  if (!activeAddress || typeof activeAddress !== "object" || Array.isArray(activeAddress)) {
    return null;
  }

  const coordinates = getMarketplaceCoordinates(activeAddress);
  return coordinates ? { ...activeAddress, ...coordinates } : { ...activeAddress };
};

export const getCustomerActiveCoordinates = (customer = {}) => {
  const activeLocation = getCustomerActiveLocation(customer);
  if (!activeLocation) {
    return null;
  }

  const coordinates = getAddressCoordinates(activeLocation);
  return coordinates && (coordinates.lat !== null || coordinates.lon !== null)
    ? { lat: coordinates.lat, lon: coordinates.lon }
    : null;
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

const normalizeLocationText = (value) => String(value ?? "")
  .trim()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .replace(/\s+/g, " ")
  .toLowerCase();

const valuesMatch = (left, right) => {
  const normalizedLeft = normalizeLocationText(left);
  const normalizedRight = normalizeLocationText(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  return normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
};

const getLocationMatchSource = (source = {}) => {
  if (!source || typeof source !== "object") {
    return {};
  }

  const nestedAddress = source.address && typeof source.address === "object" && !Array.isArray(source.address)
    ? source.address
    : {};

  return {
    ...source,
    ...nestedAddress,
    ...(source.coordinates && typeof source.coordinates === "object" ? source.coordinates : {}),
    ...(source.location && typeof source.location === "object" ? source.location : {}),
  };
};

const getLocationMatchValue = (source = {}, keys = []) => {
  const matchSource = getLocationMatchSource(source);

  for (const key of keys) {
    const rawValue = matchSource[key];
    const textValue = typeof rawValue === "string" ? rawValue : typeof rawValue === "number" ? String(rawValue) : "";

    if (textValue.trim()) {
      return textValue.trim();
    }
  }

  return "";
};

const getLocationMatchContext = (source = {}) => {
  const matchSource = getLocationMatchSource(source);
  return {
    country: getLocationMatchValue(matchSource, ["country", "countryName"]),
    state: getLocationMatchValue(matchSource, ["state", "stateName"]),
    district: getLocationMatchValue(matchSource, ["district", "districtName", "cityDistrict"]),
    city: getLocationMatchValue(matchSource, ["city", "cityName", "town", "village", "municipality", "locality"]),
    area: getLocationMatchValue(matchSource, ["area", "areaName", "road", "street", "suburb"]),
    lat: sanitizeLatLon(matchSource.lat ?? matchSource.latitude ?? matchSource.coordinates?.lat ?? null, null),
    lon: sanitizeLatLon(matchSource.lon ?? matchSource.lng ?? matchSource.longitude ?? matchSource.coordinates?.lon ?? null, null),
  };
};

const locationHierarchyMatches = (customerLocation, sellerLocation) => {
  if (!customerLocation || !sellerLocation) {
    return false;
  }

  const customer = getLocationMatchContext(customerLocation);
  const seller = getLocationMatchContext(sellerLocation);

  if (customer.country && seller.country && !valuesMatch(customer.country, seller.country)) {
    return false;
  }

  if (customer.state && seller.state && !valuesMatch(customer.state, seller.state)) {
    return false;
  }

  if (customer.city && seller.city) {
    return valuesMatch(customer.city, seller.city);
  }

  if (customer.city && seller.district && customer.district && valuesMatch(customer.district, seller.district)) {
    return true;
  }

  if (!customer.city && customer.district && seller.district) {
    return valuesMatch(customer.district, seller.district);
  }

  return false;
};

export const getSellerCoordinates = (sellerData = {}) => getMarketplaceCoordinates(sellerData);

export const calculateDistance = (pointA, pointB, latitude2, longitude2) => {
  const firstPoint = latitude2 === undefined && longitude2 === undefined
    ? pointA
    : { lat: pointA, lon: pointB };
  const secondPoint = latitude2 === undefined && longitude2 === undefined
    ? pointB
    : { lat: latitude2, lon: longitude2 };
  const first = getAddressCoordinates(firstPoint);
  const second = getAddressCoordinates(secondPoint);
  if (!first || !second) {
    return Number.POSITIVE_INFINITY;
  }

  return haversineDistanceKm(first.lat, first.lon, second.lat, second.lon);
};

export const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const first = getAddressCoordinates({ lat: lat1, lon: lon1 });
  const second = getAddressCoordinates({ lat: lat2, lon: lon2 });
  if (!first || !second) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadiusKm = 6371;
  const toRadians = (degree) => (degree * Math.PI) / 180;
  const deltaLat = toRadians(second.lat - first.lat);
  const deltaLon = toRadians(second.lon - first.lon);
  const startLat = toRadians(first.lat);
  const endLat = toRadians(second.lat);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(startLat) *
      Math.cos(endLat) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const boundedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(boundedA), Math.sqrt(1 - boundedA));

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
  const customerAddress = getLocationMatchContext(customerLocation || {});
  const customerCoordinates = getAddressCoordinates(customerLocation);

  if (!customerCoordinates && !customerAddress.country && !customerAddress.state && !customerAddress.city && !customerAddress.district) {
    logMarketplaceDiagnostic("[MARKET DEBUG] customer location unavailable", {
      reason: "missing_customer_address_and_coordinates",
    });
    return [];
  }

  logMarketplaceDiagnostic("[MARKET DEBUG] customer location context", {
    customerAddress,
    customerCoordinates,
  });

  const nearbySellerIds = [];

  Object.entries(sellerLocationMap).forEach(([sellerId, sellerLocation]) => {
    const sellerAddress = getLocationMatchContext(sellerLocation || {});
    const sellerCoordinates = getAddressCoordinates(sellerLocation);
    const matchesLocationHierarchy = locationHierarchyMatches(customerLocation, sellerLocation);

    if (matchesLocationHierarchy) {
      nearbySellerIds.push(sellerId);
      logMarketplaceDiagnostic("[MARKET DEBUG] seller matched by hierarchy", {
        sellerId,
        sellerAddress,
        reason: "city_or_district_match",
      });
      return;
    }

    if (!sellerCoordinates || !customerCoordinates) {
      logMarketplaceDiagnostic("[MARKET DEBUG] seller excluded", {
        sellerId,
        sellerAddress,
        reason: sellerCoordinates ? "missing_customer_coordinates" : "missing_or_invalid_seller_coordinates",
      });
      return;
    }

    const distanceKm = haversineDistanceKm(
      customerCoordinates.lat,
      customerCoordinates.lon,
      sellerCoordinates.lat,
      sellerCoordinates.lon
    );
    const included = Number.isFinite(distanceKm) && distanceKm <= NEARBY_DISTANCE_KM;

    logMarketplaceDiagnostic("[MARKET DEBUG] seller distance", {
      sellerId,
      coordinates: sellerCoordinates,
      distanceKm,
      included,
      reason: Number.isFinite(distanceKm)
        ? included ? "within_radius" : "outside_radius"
        : "invalid_distance",
    });

    if (included) {
      nearbySellerIds.push(sellerId);
    }
  });

  logMarketplaceDiagnostic("[MARKET DEBUG] nearby seller IDs", nearbySellerIds);
  return nearbySellerIds;
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

        if (marketMode === MARKET_MODES.LOCAL) {
          const productCountsBySeller = {};
          catalog.forEach((product) => {
            const sellerId = String(product.shopId || product.sellerId || "");
            productCountsBySeller[sellerId || "(missing)"] =
              (productCountsBySeller[sellerId || "(missing)"] || 0) + 1;
          });
          logMarketplaceDiagnostic("[MARKET DEBUG] local inventory snapshot", {
            collectionGroup: collectionName,
            documents: snapshot.size,
            mappedProducts: catalog.length,
            productCountsBySeller,
          });
        }

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

const getSellerAddressText = (sellerData) => {
  const address = sellerData?.address;
  if (typeof address === "string") {
    return safeText(address);
  }

  if (!address || typeof address !== "object" || Array.isArray(address)) {
    return "";
  }

  return safeText(
    address.fullAddress
      || address.formattedAddress
      || address.address
      || [
        address.area,
        address.city,
        address.district,
        address.state,
        address.country,
        address.pincode,
      ].filter(Boolean).join(", ")
  );
};

const getSellerImage = (sellerData) => {
  const imageFields = [
    "shopImage",
    "local_shopImage",
    "global_shopImage",
    "shopLogo",
    "local_shopLogo",
    "global_shopLogo",
    "profileImage",
    "local_profileImage",
    "global_profileImage",
  ];

  for (const field of imageFields) {
    const value = sellerData?.[field];
    if (typeof value !== "string") {
      continue;
    }

    const image = value.trim();
    const isDataImage = /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(image);
    if (isDataImage) {
      return image;
    }

    try {
      const imageUrl = new URL(image);
      if (
        (imageUrl.protocol === "http:" || imageUrl.protocol === "https:")
        && imageUrl.hostname
      ) {
        return image;
      }
    } catch {
      // Continue to the next saved image field if this value is not a URL.
    }
  }

  return "";
};

export const subscribeMarketplaceSellerProfiles = ({ onSellers, onError }) => {
  if (!db) {
    const error = new Error("Firebase Firestore is not configured.");
    console.error("[MARKET] Seller profiles unavailable:", error);
    if (typeof onError === "function") {
      onError(error);
    }
    return () => {};
  }

  const sellersQuery = query(collection(db, "users"), where("role", "==", "seller"));
  const unsubscribe = onSnapshot(
    sellersQuery,
    (snapshot) => {
      const sellers = snapshot.docs.map((sellerSnapshot) => {
        const sellerData = sellerSnapshot.data() || {};
        const coordinates = getSellerCoordinates(sellerData);
        logMarketplaceDiagnostic(
          "[MARKET DEBUG] seller coordinate resolution",
          {
            sellerId: sellerSnapshot.id,
            coordinates,
            reason: coordinates
              ? "saved_shop_coordinates"
              : "missing_or_invalid_saved_shop_coordinates",
          }
        );
        const addressData = getLocationMatchContext(sellerData);

        return {
          id: sellerSnapshot.id,
          shopName: safeText(
            sellerData.shopName || sellerData.storeName || sellerData.name,
            "Store"
          ),
          image: getSellerImage(sellerData),
          address: getSellerAddressText(sellerData),
          coordinates,
          addressData: {
            ...addressData,
            ...(coordinates ? { lat: coordinates.lat, lon: coordinates.lon } : {}),
          },
        };
      });

      if (typeof onSellers === "function") {
        onSellers(sellers);
      }
    },
    (error) => {
      console.error("[MARKET] Seller profiles listener failed:", error);
      if (typeof onError === "function") {
        onError(error);
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
        const coordinates = getSellerCoordinates(sellerData);

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
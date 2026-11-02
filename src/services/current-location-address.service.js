import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
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
  road: String(address.road || "").trim(),
  pincode: String(address.pincode || "").trim(),
});

export const BASE_LOCATION_HIERARCHY = {
  india: {
    id: 'india',
    name: 'India',
    flag: '🇮🇳',
    storeCount: 3,
    states: {
      tamil_nadu: {
        id: 'tamil_nadu',
        name: 'Tamil Nadu',
        storeCount: 3,
        districts: {
          virudhunagar: {
            id: 'virudhunagar',
            name: 'Virudhunagar',
            storeCount: 3,
            cities: {
              sattur: {
                id: 'sattur',
                name: 'Sattur',
                district: 'Virudhunagar',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.3639,
                lon: 77.9254,
                pincode: '626203',
                storeCount: 2,
                streets: [
                  { name: 'Padanthal', lat: 9.3565, lon: 77.9250, pincode: '626203', isStore: true },
                  { name: 'Main Road / Bazaar', lat: 9.3642, lon: 77.9260, pincode: '626203', isStore: true },
                  { name: 'Bus Stand Area', lat: 9.3628, lon: 77.9248, pincode: '626203' },
                  { name: 'Railway Station Road', lat: 9.3665, lon: 77.9275, pincode: '626203' },
                  { name: 'North Car Street', lat: 9.3650, lon: 77.9255, pincode: '626203' },
                  { name: 'Melapudur', lat: 9.3580, lon: 77.9220, pincode: '626203' },
                  { name: 'Kamarajar Nagar', lat: 9.3610, lon: 77.9290, pincode: '626203' },
                  { name: 'Venkatachalapuram', lat: 9.3520, lon: 77.9180, pincode: '626203' },
                ],
              },
              padanthal: {
                id: 'padanthal',
                name: 'Padanthal',
                district: 'Virudhunagar',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.3565,
                lon: 77.9250,
                pincode: '626203',
                storeCount: 1,
                streets: [
                  { name: 'Padanthal Main Area', lat: 9.3565, lon: 77.9250, pincode: '626203', isStore: true },
                  { name: 'Kamaraj Nagar', lat: 9.3580, lon: 77.9230, pincode: '626203' },
                  { name: 'College Road', lat: 9.3540, lon: 77.9260, pincode: '626203' },
                ],
              },
              virudhunagar: {
                id: 'virudhunagar',
                name: 'Virudhunagar',
                district: 'Virudhunagar',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.5680,
                lon: 77.9624,
                pincode: '626001',
                storeCount: 1,
                streets: [
                  { name: 'Main Bazaar', lat: 9.5685, lon: 77.9620, pincode: '626001', isStore: true },
                  { name: 'Madurai Road', lat: 9.5750, lon: 77.9650, pincode: '626001' },
                  { name: 'Railway Feeder Road', lat: 9.5660, lon: 77.9600, pincode: '626001' },
                  { name: 'Collectorate Complex / Kooraikundu', lat: 9.5850, lon: 77.9550, pincode: '626002' },
                  { name: 'Ramamoorthy Road', lat: 9.5695, lon: 77.9640, pincode: '626001' },
                  { name: 'Aruppukottai Road', lat: 9.5640, lon: 77.9710, pincode: '626001' },
                  { name: 'Kamarajar Salai', lat: 9.5710, lon: 77.9630, pincode: '626001' },
                  { name: 'Allampatti', lat: 9.5590, lon: 77.9680, pincode: '626001' },
                  { name: 'Rosalpatti', lat: 9.5520, lon: 77.9590, pincode: '626001' },
                ],
              },
              sivakasi: {
                id: 'sivakasi',
                name: 'Sivakasi',
                district: 'Virudhunagar',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.4533,
                lon: 77.7947,
                pincode: '626123',
                storeCount: 1,
                streets: [
                  { name: 'Main Bazaar', lat: 9.4533, lon: 77.7947, pincode: '626123', isStore: true },
                  { name: 'NRKR Road', lat: 9.4510, lon: 77.7980, pincode: '626123' },
                  { name: 'Bus Stand Area', lat: 9.4560, lon: 77.7930, pincode: '626123' },
                  { name: 'Coronation Colony', lat: 9.4590, lon: 77.8010, pincode: '626123' },
                  { name: 'Palaniandavar Colony', lat: 9.4620, lon: 77.7910, pincode: '626123' },
                  { name: 'Thiruthangal Road', lat: 9.4750, lon: 77.8050, pincode: '626130' },
                  { name: 'Paraipatti', lat: 9.4470, lon: 77.7880, pincode: '626123' },
                ],
              },
              aruppukkottai: {
                id: 'aruppukkottai',
                name: 'Aruppukkottai',
                district: 'Virudhunagar',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.5103,
                lon: 78.0984,
                pincode: '626101',
                storeCount: 0,
                streets: [
                  { name: 'Main Bazaar', lat: 9.5103, lon: 78.0984, pincode: '626101' },
                  { name: 'Bus Stand Area', lat: 9.5120, lon: 78.0950, pincode: '626101' },
                  { name: 'Railway Feeder Road', lat: 9.5080, lon: 78.1020, pincode: '626101' },
                  { name: 'Gandhi Nagar', lat: 9.5150, lon: 78.0920, pincode: '626101' },
                ],
              },
              rajapalayam: {
                id: 'rajapalayam',
                name: 'Rajapalayam',
                district: 'Virudhunagar',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.4532,
                lon: 77.5540,
                pincode: '626117',
                storeCount: 0,
                streets: [
                  { name: 'Main Bazaar', lat: 9.4532, lon: 77.5540, pincode: '626117' },
                  { name: 'PACR Road', lat: 9.4580, lon: 77.5590, pincode: '626117' },
                  { name: 'Tenkasi Road', lat: 9.4480, lon: 77.5490, pincode: '626117' },
                  { name: 'Gandhi Kalaimandram Area', lat: 9.4550, lon: 77.5520, pincode: '626117' },
                ],
              },
              srivilliputhur: {
                id: 'srivilliputhur',
                name: 'Srivilliputhur',
                district: 'Virudhunagar',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.5107,
                lon: 77.6322,
                pincode: '626125',
                storeCount: 0,
                streets: [
                  { name: 'Andal Temple / Car Street', lat: 9.5107, lon: 77.6322, pincode: '626125' },
                  { name: 'Madurai Road', lat: 9.5160, lon: 77.6380, pincode: '626125' },
                  { name: 'Bus Stand Area', lat: 9.5120, lon: 77.6290, pincode: '626125' },
                ],
              },
            },
          },
          thoothukudi: {
            id: 'thoothukudi',
            name: 'Thoothukudi',
            storeCount: 0,
            cities: {
              kovilpatti: {
                id: 'kovilpatti',
                name: 'Kovilpatti',
                district: 'Thoothukudi',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.1729,
                lon: 77.8687,
                pincode: '628501',
                storeCount: 0,
                streets: [
                  { name: 'Main Road', lat: 9.1729, lon: 77.8687, pincode: '628501' },
                  { name: 'New Bus Stand', lat: 9.1780, lon: 77.8720, pincode: '628501' },
                  { name: 'Old Bus Stand', lat: 9.1690, lon: 77.8650, pincode: '628501' },
                ],
              },
            },
          },
          madurai: {
            id: 'madurai',
            name: 'Madurai',
            storeCount: 0,
            cities: {
              madurai: {
                id: 'madurai',
                name: 'Madurai',
                district: 'Madurai',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 9.9252,
                lon: 78.1198,
                pincode: '625001',
                storeCount: 0,
                streets: [
                  { name: 'Meenakshi Amman Temple / South Masi St', lat: 9.9195, lon: 78.1193, pincode: '625001' },
                  { name: 'KK Nagar', lat: 9.9320, lon: 78.1480, pincode: '625020' },
                  { name: 'Anna Nagar', lat: 9.9210, lon: 78.1450, pincode: '625020' },
                  { name: 'Simmakkal', lat: 9.9270, lon: 78.1230, pincode: '625001' },
                  { name: 'Mattuthavani', lat: 9.9450, lon: 78.1620, pincode: '625007' },
                  { name: 'Goripalayam', lat: 9.9310, lon: 78.1310, pincode: '625002' },
                  { name: 'Periyar Bus Stand', lat: 9.9170, lon: 78.1130, pincode: '625001' },
                ],
              },
            },
          },
          chennai: {
            id: 'chennai',
            name: 'Chennai',
            storeCount: 0,
            cities: {
              chennai: {
                id: 'chennai',
                name: 'Chennai',
                district: 'Chennai',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 13.0827,
                lon: 80.2707,
                pincode: '600001',
                storeCount: 0,
                streets: [
                  { name: 'T. Nagar', lat: 13.0418, lon: 80.2341, pincode: '600017' },
                  { name: 'Adyar', lat: 13.0012, lon: 80.2565, pincode: '600020' },
                  { name: 'Anna Nagar', lat: 13.0850, lon: 80.2100, pincode: '600040' },
                  { name: 'Velachery', lat: 12.9750, lon: 80.2200, pincode: '600042' },
                  { name: 'Mylapore', lat: 13.0330, lon: 80.2670, pincode: '600004' },
                  { name: 'Guindy', lat: 13.0067, lon: 80.2025, pincode: '600032' },
                  { name: 'Tambaram', lat: 12.9249, lon: 80.1000, pincode: '600045' },
                ],
              },
            },
          },
          coimbatore: {
            id: 'coimbatore',
            name: 'Coimbatore',
            storeCount: 0,
            cities: {
              coimbatore: {
                id: 'coimbatore',
                name: 'Coimbatore',
                district: 'Coimbatore',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 11.0168,
                lon: 76.9558,
                pincode: '641001',
                storeCount: 0,
                streets: [
                  { name: 'RS Puram', lat: 11.0080, lon: 76.9510, pincode: '641002' },
                  { name: 'Gandhipuram', lat: 11.0180, lon: 76.9680, pincode: '641012' },
                  { name: 'Peelamedu', lat: 11.0280, lon: 77.0120, pincode: '641004' },
                  { name: 'Saibaba Colony', lat: 11.0320, lon: 76.9450, pincode: '641011' },
                ],
              },
            },
          },
          tirunelveli: {
            id: 'tirunelveli',
            name: 'Tirunelveli',
            storeCount: 0,
            cities: {
              tirunelveli: {
                id: 'tirunelveli',
                name: 'Tirunelveli',
                district: 'Tirunelveli',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 8.7139,
                lon: 77.7567,
                pincode: '627001',
                storeCount: 0,
                streets: [
                  { name: 'Palayamkottai', lat: 8.7190, lon: 77.7420, pincode: '627002' },
                  { name: 'Junction / Bus Stand', lat: 8.7280, lon: 77.7210, pincode: '627001' },
                  { name: 'Town / Nellaiappar Temple', lat: 8.7290, lon: 77.6980, pincode: '627006' },
                ],
              },
            },
          },
          salem: {
            id: 'salem',
            name: 'Salem',
            storeCount: 0,
            cities: {
              salem: {
                id: 'salem',
                name: 'Salem',
                district: 'Salem',
                state: 'Tamil Nadu',
                country: 'India',
                lat: 11.6643,
                lon: 78.1460,
                pincode: '636001',
                storeCount: 0,
                streets: [
                  { name: 'Fairlands', lat: 11.6780, lon: 78.1420, pincode: '636016' },
                  { name: 'Four Roads', lat: 11.6580, lon: 78.1520, pincode: '636009' },
                  { name: 'New Bus Stand', lat: 11.6690, lon: 78.1380, pincode: '636004' },
                ],
              },
            },
          },
        },
      },
      kerala: {
        id: 'kerala',
        name: 'Kerala',
        storeCount: 0,
        districts: {
          ernakulam: {
            id: 'ernakulam',
            name: 'Ernakulam',
            storeCount: 0,
            cities: {
              kochi: {
                id: 'kochi',
                name: 'Kochi',
                district: 'Ernakulam',
                state: 'Kerala',
                country: 'India',
                lat: 9.9312,
                lon: 76.2673,
                pincode: '682001',
                storeCount: 0,
                streets: [
                  { name: 'MG Road', lat: 9.9720, lon: 76.2840, pincode: '682035' },
                  { name: 'Marine Drive', lat: 9.9810, lon: 76.2750, pincode: '682031' },
                  { name: 'Fort Kochi', lat: 9.9650, lon: 76.2420, pincode: '682001' },
                  { name: 'Edappally', lat: 10.0260, lon: 76.3080, pincode: '682024' },
                ],
              },
            },
          },
          thiruvananthapuram: {
            id: 'thiruvananthapuram',
            name: 'Thiruvananthapuram',
            storeCount: 0,
            cities: {
              thiruvananthapuram: {
                id: 'thiruvananthapuram',
                name: 'Thiruvananthapuram',
                district: 'Thiruvananthapuram',
                state: 'Kerala',
                country: 'India',
                lat: 8.5241,
                lon: 76.9366,
                pincode: '695001',
                storeCount: 0,
                streets: [
                  { name: 'East Fort', lat: 8.4830, lon: 76.9480, pincode: '695023' },
                  { name: 'Palayam', lat: 8.5020, lon: 76.9510, pincode: '695034' },
                  { name: 'Kowdiar', lat: 8.5280, lon: 76.9640, pincode: '695003' },
                ],
              },
            },
          },
        },
      },
      karnataka: {
        id: 'karnataka',
        name: 'Karnataka',
        storeCount: 0,
        districts: {
          bengaluru_urban: {
            id: 'bengaluru_urban',
            name: 'Bengaluru Urban',
            storeCount: 0,
            cities: {
              bengaluru: {
                id: 'bengaluru',
                name: 'Bengaluru',
                district: 'Bengaluru Urban',
                state: 'Karnataka',
                country: 'India',
                lat: 12.9716,
                lon: 77.5946,
                pincode: '560001',
                storeCount: 0,
                streets: [
                  { name: 'Indiranagar', lat: 12.9784, lon: 77.6408, pincode: '560038' },
                  { name: 'Koramangala', lat: 12.9352, lon: 77.6245, pincode: '560034' },
                  { name: 'Whitefield', lat: 12.9698, lon: 77.7500, pincode: '560066' },
                  { name: 'Jayanagar', lat: 12.9308, lon: 77.5838, pincode: '560041' },
                  { name: 'MG Road', lat: 12.9756, lon: 77.6066, pincode: '560001' },
                ],
              },
            },
          },
        },
      },
      maharashtra: {
        id: 'maharashtra',
        name: 'Maharashtra',
        storeCount: 0,
        districts: {
          mumbai: {
            id: 'mumbai',
            name: 'Mumbai',
            storeCount: 0,
            cities: {
              mumbai: {
                id: 'mumbai',
                name: 'Mumbai',
                district: 'Mumbai',
                state: 'Maharashtra',
                country: 'India',
                lat: 19.0760,
                lon: 72.8777,
                pincode: '400001',
                storeCount: 0,
                streets: [
                  { name: 'Bandra West', lat: 19.0596, lon: 72.8295, pincode: '400050' },
                  { name: 'Andheri West', lat: 19.1197, lon: 72.8468, pincode: '400058' },
                  { name: 'Colaba', lat: 18.9067, lon: 72.8147, pincode: '400005' },
                  { name: 'Juhu', lat: 19.1075, lon: 72.8263, pincode: '400049' },
                ],
              },
            },
          },
          pune: {
            id: 'pune',
            name: 'Pune',
            storeCount: 0,
            cities: {
              pune: {
                id: 'pune',
                name: 'Pune',
                district: 'Pune',
                state: 'Maharashtra',
                country: 'India',
                lat: 18.5204,
                lon: 73.8567,
                pincode: '411001',
                storeCount: 0,
                streets: [
                  { name: 'Kothrud', lat: 18.5074, lon: 73.8077, pincode: '411038' },
                  { name: 'Koregaon Park', lat: 18.5362, lon: 73.8940, pincode: '411001' },
                  { name: 'Viman Nagar', lat: 18.5679, lon: 73.9143, pincode: '411014' },
                ],
              },
            },
          },
        },
      },
      delhi: {
        id: 'delhi',
        name: 'Delhi',
        storeCount: 0,
        districts: {
          new_delhi: {
            id: 'new_delhi',
            name: 'New Delhi',
            storeCount: 0,
            cities: {
              new_delhi: {
                id: 'new_delhi',
                name: 'New Delhi',
                district: 'New Delhi',
                state: 'Delhi',
                country: 'India',
                lat: 28.6139,
                lon: 77.2090,
                pincode: '110001',
                storeCount: 0,
                streets: [
                  { name: 'Connaught Place', lat: 28.6315, lon: 77.2167, pincode: '110001' },
                  { name: 'South Extension', lat: 28.5724, lon: 77.2208, pincode: '110049' },
                  { name: 'Hauz Khas', lat: 28.5494, lon: 77.2001, pincode: '110016' },
                ],
              },
            },
          },
        },
      },
    },
  },
  united_arab_emirates: {
    id: 'united_arab_emirates',
    name: 'United Arab Emirates',
    flag: '🇦🇪',
    storeCount: 0,
    states: {
      dubai: {
        id: 'dubai',
        name: 'Dubai',
        storeCount: 0,
        districts: {
          dubai: {
            id: 'dubai',
            name: 'Dubai City',
            storeCount: 0,
            cities: {
              dubai: {
                id: 'dubai',
                name: 'Dubai',
                district: 'Dubai City',
                state: 'Dubai',
                country: 'United Arab Emirates',
                lat: 25.2048,
                lon: 55.2708,
                pincode: '',
                storeCount: 0,
                streets: [
                  { name: 'Downtown / Burj Khalifa', lat: 25.1972, lon: 55.2744 },
                  { name: 'Dubai Marina', lat: 25.0805, lon: 55.1403 },
                  { name: 'Deira / Gold Souk', lat: 25.2711, lon: 55.3075 },
                  { name: 'Bur Dubai', lat: 25.2532, lon: 55.2974 },
                  { name: 'Jumeirah', lat: 25.1872, lon: 55.2446 },
                ],
              },
            },
          },
        },
      },
      abu_dhabi: {
        id: 'abu_dhabi',
        name: 'Abu Dhabi',
        storeCount: 0,
        districts: {
          abu_dhabi: {
            id: 'abu_dhabi',
            name: 'Abu Dhabi City',
            storeCount: 0,
            cities: {
              abu_dhabi: {
                id: 'abu_dhabi',
                name: 'Abu Dhabi',
                district: 'Abu Dhabi City',
                state: 'Abu Dhabi',
                country: 'United Arab Emirates',
                lat: 24.4539,
                lon: 54.3773,
                pincode: '',
                storeCount: 0,
                streets: [
                  { name: 'Corniche Road', lat: 24.4764, lon: 54.3312 },
                  { name: 'Al Reem Island', lat: 24.4984, lon: 54.4072 },
                  { name: 'Yas Island', lat: 24.4988, lon: 54.6044 },
                ],
              },
            },
          },
        },
      },
    },
  },
  sri_lanka: {
    id: 'sri_lanka',
    name: 'Sri Lanka',
    flag: '🇱🇰',
    storeCount: 0,
    states: {
      western_province: {
        id: 'western_province',
        name: 'Western Province',
        storeCount: 0,
        districts: {
          colombo: {
            id: 'colombo',
            name: 'Colombo District',
            storeCount: 0,
            cities: {
              colombo: {
                id: 'colombo',
                name: 'Colombo',
                district: 'Colombo District',
                state: 'Western Province',
                country: 'Sri Lanka',
                lat: 6.9271,
                lon: 79.8612,
                pincode: '',
                storeCount: 0,
                streets: [
                  { name: 'Pettah Main Street', lat: 6.9388, lon: 79.8540 },
                  { name: 'Galle Face Green', lat: 6.9249, lon: 79.8458 },
                  { name: 'Kollupitiya', lat: 6.9080, lon: 79.8510 },
                  { name: 'Bambalapitiya', lat: 6.8920, lon: 79.8550 },
                ],
              },
            },
          },
        },
      },
    },
  },
  singapore: {
    id: 'singapore',
    name: 'Singapore',
    flag: '🇸🇬',
    storeCount: 0,
    states: {
      central_region: {
        id: 'central_region',
        name: 'Central Region',
        storeCount: 0,
        districts: {
          central: {
            id: 'central',
            name: 'Central Area',
            storeCount: 0,
            cities: {
              singapore: {
                id: 'singapore',
                name: 'Singapore',
                district: 'Central Area',
                state: 'Central Region',
                country: 'Singapore',
                lat: 1.3521,
                lon: 103.8198,
                pincode: '',
                storeCount: 0,
                streets: [
                  { name: 'Orchard Road', lat: 1.3048, lon: 103.8318 },
                  { name: 'Marina Bay Sands', lat: 1.2834, lon: 103.8607 },
                  { name: 'Little India', lat: 1.3068, lon: 103.8519 },
                  { name: 'Chinatown', lat: 1.2815, lon: 103.8436 },
                ],
              },
            },
          },
        },
      },
    },
  },
};

const toFiniteNumber = (value) => {
  if (
    (typeof value !== "number" && typeof value !== "string")
    || (typeof value === "string" && !value.trim())
  ) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isValidLatLonPair = (lat, lon) => {
  if (lat === null || lon === null) {
    return false;
  }

  return Number.isFinite(lat)
    && Number.isFinite(lon)
    && lat >= -90
    && lat <= 90
    && lon >= -180
    && lon <= 180;
};

export const calculateDistance = (pointA, pointB, latitude2, longitude2) => {
  const first = latitude2 === undefined && longitude2 === undefined
    ? pointA
    : { lat: pointA, lon: pointB };
  const second = latitude2 === undefined && longitude2 === undefined
    ? pointB
    : { lat: latitude2, lon: longitude2 };
  const lat1 = toFiniteNumber(first?.lat ?? first?.latitude);
  const lon1 = toFiniteNumber(first?.lon ?? first?.lng ?? first?.longitude);
  const lat2 = toFiniteNumber(second?.lat ?? second?.latitude);
  const lon2 = toFiniteNumber(second?.lon ?? second?.lng ?? second?.longitude);

  if (!isValidLatLonPair(lat1, lon1) || !isValidLatLonPair(lat2, lon2)) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadiusKm = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const startLat = toRadians(lat1);
  const endLat = toRadians(lat2);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

export const getSellerCoordinates = (sellerData = {}) => {
  const source = sellerData && typeof sellerData === "object" ? sellerData : {};
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
  const sources = [];
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
    sources.push(candidate);
    nestedFields.forEach((field) => {
      const nested = candidate[field];
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        queue.push(nested);
      }
    });
  }

  for (const candidate of sources) {
    const lat = toFiniteNumber(candidate.lat ?? candidate.latitude);
    const lon = toFiniteNumber(candidate.lon ?? candidate.lng ?? candidate.longitude);
    if (isValidLatLonPair(lat, lon)) {
      return { lat, lon };
    }
  }

  return null;
};

const safeLocalStorage = {
  getItem: (key) => {
    try {
      if (typeof window === "undefined") {
        return null;
      }
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, value);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  },
};

export const getCachedLocation = (storageKey = "kadai_active_location") => {
  const rawValue = safeLocalStorage.getItem(storageKey);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

export const saveActiveLocation = (location, storageKey = "kadai_active_location") => {
  if (!location || typeof location !== "object" || Array.isArray(location)) {
    throw new Error("Cannot cache an invalid active address.");
  }

  const lat = toFiniteNumber(location.lat ?? location.latitude);
  const lon = toFiniteNumber(location.lon ?? location.lng ?? location.longitude);
  const hasCoordinates = isValidLatLonPair(lat, lon);

  if (import.meta.env.DEV) {
    console.debug("[LOCATION DEBUG] caching active address", {
      hasCoordinates,
      city: location.city || "",
      district: location.district || "",
      state: location.state || "",
      country: location.country || "",
      fullAddress: location.fullAddress || location.address || "",
      lat,
      lon,
    });
  }

  const nextLocation = {
    ...location,
    lat: lat ?? null,
    lon: lon ?? null,
    latitude: lat ?? null,
    longitude: lon ?? null,
  };

  if (!safeLocalStorage.setItem(storageKey, JSON.stringify(nextLocation))) {
    console.warn("[LOCATION] Active address saved in Firestore but browser storage is unavailable.");
  }
  return nextLocation;
};

export const getActiveLocationStorageKey = (userId) =>
  userId ? `kadai_active_location:${userId}` : "kadai_active_location";

export const fetchUserSavedAddresses = (customer = []) => {
  if (Array.isArray(customer)) {
    return customer.filter(Boolean);
  }

  if (!customer || typeof customer !== "object") {
    return [];
  }

  const directAddresses = Array.isArray(customer.addresses) ? customer.addresses : [];
  const fallbackAddress = customer.address ? [customer.address] : [];
  return [...directAddresses, ...fallbackAddress].filter(Boolean);
};

export const detectUserLocation = async () => getCurrentLocationAddress();

const normalizeLanguageLabel = (value) => String(value ?? "")
  .trim()
  .replace(/\s+/g, " ");

const normalizeEnglishAddressText = (value, fallback = "") => {
  const text = normalizeLanguageLabel(value);
  return text || fallback;
};

const sanitizeEnglishAddress = (address = {}) => {
  const country = normalizeEnglishAddressText(address.country, "");
  const state = normalizeEnglishAddressText(address.state, "");
  const district = normalizeEnglishAddressText(address.district, "");
  const city = normalizeEnglishAddressText(address.city, "");
  const area = normalizeEnglishAddressText(address.area, "");
  const road = normalizeEnglishAddressText(address.road, "");
  const pincode = normalizeEnglishAddressText(address.postcode || address.postalCode || address.pincode, "");

  return {
    country,
    state,
    district,
    city,
    area,
    road,
    pincode,
  };
};

export const reverseGeocodeLocation = async (lat, lon) => {
  const latitude = toFiniteNumber(lat);
  const longitude = toFiniteNumber(lon);
  if (!isValidLatLonPair(latitude, longitude)) {
    throw new Error("Cannot reverse geocode invalid coordinates.");
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("accept-language", "en");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Unable to reverse geocode this location.");
  }

  const payload = await response.json();
  if (!payload || payload.error) {
    throw new Error(payload?.error || "Unable to resolve the address for this location.");
  }

  const englishAddress = sanitizeEnglishAddress(payload.address || {});
  const displayName = String(payload.display_name || "").trim();
  if (import.meta.env.DEV) {
    console.debug("[LOCATION DEBUG] reverse geocoder address", {
      country: englishAddress.country || payload.address?.country || "",
      state: englishAddress.state || payload.address?.state || "",
      district: englishAddress.district || payload.address?.state_district || payload.address?.county || payload.address?.district || "",
      city: englishAddress.city || payload.address?.city || payload.address?.town || payload.address?.village || payload.address?.municipality || "",
      area: englishAddress.area || payload.address?.suburb || payload.address?.neighbourhood || payload.address?.quarter || payload.address?.hamlet || payload.address?.locality || "",
      pincode: englishAddress.pincode || payload.address?.postcode || "",
    });
  }
  return {
    ...payload,
    address: {
      ...(payload.address || {}),
      ...englishAddress,
      country: englishAddress.country || payload.address?.country || "",
      state: englishAddress.state || payload.address?.state || "",
      district: englishAddress.district || payload.address?.state_district || payload.address?.county || payload.address?.district || "",
      city: englishAddress.city || payload.address?.city || payload.address?.town || payload.address?.village || payload.address?.municipality || "",
      area: englishAddress.area || payload.address?.suburb || payload.address?.neighbourhood || payload.address?.quarter || payload.address?.hamlet || payload.address?.locality || "",
      road: englishAddress.road || payload.address?.road || payload.address?.pedestrian || payload.address?.residential || payload.address?.street || "",
      postcode: englishAddress.pincode || payload.address?.postcode || "",
      pincode: englishAddress.pincode || payload.address?.postcode || "",
    },
    display_name: displayName || [
      payload.address?.house_number,
      payload.address?.road,
      payload.address?.suburb,
      payload.address?.city,
      payload.address?.state,
      payload.address?.country,
      payload.address?.postcode,
    ].filter(Boolean).join(", "),
  };
};

export const fetchAvailableStoreLocations = async () => {
  if (!db) {
    return [];
  }

  const sellersQuery = query(collection(db, "users"), where("role", "==", "seller"));
  const snapshot = await getDocs(sellersQuery);

  return snapshot.docs.map((sellerDoc) => {
    const sellerData = sellerDoc.data() || {};
    const coordinates = getSellerCoordinates(sellerData);

    return {
      id: sellerDoc.id,
      ...sellerData,
      coordinates,
      address: sellerData.address || {},
    };
  });
};

const findExactHierarchyEntry = (entries, value) => {
  const token = normalizeGeocodingLabel(value);
  if (!token || !entries || typeof entries !== "object") {
    return null;
  }

  return Object.entries(entries).find(([key, entry]) =>
    [key, entry?.id, entry?.name].some(
      (candidate) => normalizeGeocodingLabel(candidate) === token
    )
  )?.[1] || null;
};

const resolveKnownAreaCoordinates = (address) => {
  const areaToken = normalizeGeocodingLabel(address.area || address.road);
  if (!areaToken) {
    return null;
  }

  const country = findExactHierarchyEntry(BASE_LOCATION_HIERARCHY, address.country);
  const state = findExactHierarchyEntry(country?.states, address.state);
  const district = findExactHierarchyEntry(state?.districts, address.district);
  const city = findExactHierarchyEntry(district?.cities, address.city);
  if (!city || !Array.isArray(city.streets)) {
    return null;
  }

  const street = city.streets.find(
    (entry) => normalizeGeocodingLabel(entry?.name) === areaToken
  );
  if (!street) {
    return null;
  }

  const lat = toFiniteNumber(street.lat);
  const lon = toFiniteNumber(street.lon);
  return isValidLatLonPair(lat, lon) ? { lat, lon } : null;
};

export const resolveAreaCoordinates = (locationData = {}) => {
  const normalizedAddress = normalizeAddressPayload(locationData);
  if (
    !normalizedAddress.country
    || !normalizedAddress.state
    || !normalizedAddress.district
    || !normalizedAddress.city
    || !(normalizedAddress.area || normalizedAddress.road)
  ) {
    return null;
  }

  return resolveKnownAreaCoordinates(normalizedAddress);
};

export const forwardGeocodeAddress = async ({
  country,
  state,
  district,
  city,
  area,
  road,
  pincode,
}) => {
  const queryParts = [road, area, city, district, state, country, pincode]
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
  searchUrl.searchParams.set("accept-language", "en");

  const response = await fetch(searchUrl, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("We couldn't look up this address. Please try again.");
  }

  const results = await response.json();
  const matchingResult = (Array.isArray(results) ? results : []).find((result) => {
    const address = result?.address || {};
    const districtMatches = !district || matchesGeocodingLabel(district, [
      address.state_district,
      address.county,
      address.district,
    ]);
    const cityMatches = !city || matchesGeocodingLabel(city, [
      address.city,
      address.town,
      address.village,
      address.municipality,
      address.hamlet,
      address.locality,
      address.city_district,
    ]);
    const stateMatches = !state || matchesGeocodingLabel(state, [address.state]);
    const countryMatches = !country || matchesGeocodingLabel(country, [address.country]);
    const areaMatches = !area || matchesGeocodingLabel(area, [
      address.suburb,
      address.neighbourhood,
      address.quarter,
      address.city_district,
      address.hamlet,
      address.locality,
      address.village,
    ]);
    const roadMatches = !road || matchesGeocodingLabel(road, [
      address.road,
      address.pedestrian,
      address.residential,
      address.street,
      address.footway,
      address.path,
    ]);
    const normalizedPincode = String(pincode || "").trim();
    const resultPincode = String(address.postcode || "").trim();
    const pincodeMatches = !normalizedPincode
      || !resultPincode
      || normalizedPincode === resultPincode;
    return districtMatches
      && cityMatches
      && stateMatches
      && countryMatches
      && areaMatches
      && roadMatches
      && pincodeMatches;
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
  road,
  pincode,
  areaCoordinates,
}) => {
  if (![country, state, district, city].every((value) => String(value || "").trim())) {
    throw new Error("Please select a City, District, State, and Country before locating this address.");
  }

  const geocodedCoordinates = await forwardGeocodeAddress({
    country,
    state,
    district,
    city,
    area,
    road,
    pincode,
  });
  if (geocodedCoordinates) {
    return geocodedCoordinates;
  }

  const areaLatitude = toFiniteNumber(areaCoordinates?.lat ?? areaCoordinates?.latitude);
  const areaLongitude = toFiniteNumber(
    areaCoordinates?.lon ?? areaCoordinates?.lng ?? areaCoordinates?.longitude
  );
  if (isValidLatLonPair(areaLatitude, areaLongitude)) {
    return { lat: areaLatitude, lon: areaLongitude };
  }

  const exactAreaCoordinates = resolveAreaCoordinates({
    country,
    state,
    district,
    city,
    area,
    road,
  });
  if (exactAreaCoordinates) {
    return exactAreaCoordinates;
  }

  throw new Error(
    "We couldn't resolve this selected address. Check the area or street and try again; no previous or default coordinates were used."
  );
};

export const getCurrentLocationAddress = async () => {
  const coordinates = await getCoordinates();
  const data = await reverseGeocodeLocation(coordinates.latitude, coordinates.longitude);
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
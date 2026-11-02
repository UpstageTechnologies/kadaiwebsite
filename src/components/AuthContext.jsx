import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  auth,
  firebaseCustomerDoc,
  firebaseUpdateCustomer,
  onSnapshot,
} from "../services/firebase";
import {
  getActiveLocationStorageKey,
  saveActiveLocation,
} from "../services/current-location-address.service";

const AuthContext = createContext({
  user: null,
  customer: null,
  customerError: "",
  loading: true,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [customerError, setCustomerError] = useState("");
  const [loading, setLoading] = useState(Boolean(auth));

  const updateCustomerAddress = useCallback(async (address) => {
    const customerUid = auth?.currentUser?.uid || "";
    if (!customerUid) {
      throw new Error("Your Firebase session is missing. Please log in again.");
    }

    await firebaseUpdateCustomer(customerUid, { address });
    const activeAddress = saveActiveLocation(
      address,
      getActiveLocationStorageKey(customerUid)
    );

    if (auth?.currentUser?.uid === customerUid) {
      setCustomer((currentCustomer) => ({
        ...(currentCustomer || {}),
        uid: customerUid,
        address: activeAddress || address,
      }));
    }

    if (import.meta.env.DEV) {
      console.debug("[AUTH DEBUG] customer address saved and refreshed", {
        city: address.city || "",
        district: address.district || "",
        state: address.state || "",
        country: address.country || "",
        hasCoordinates: Boolean(address.lat != null && address.lon != null),
        addressField: "customers/{uid}.address",
      });
    }

    return activeAddress || address;
  }, []);

  useEffect(() => {
    if (!auth) return undefined;

    let unsubscribeCustomer = () => {};
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeCustomer();
      unsubscribeCustomer = () => {};
      setUser(firebaseUser);
      setCustomer(null);
      setCustomerError("");

      if (!firebaseUser?.uid) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const customerRef = firebaseCustomerDoc(firebaseUser.uid);
      if (!customerRef) {
        setLoading(false);
        return;
      }

      unsubscribeCustomer = onSnapshot(
        customerRef,
        (snapshot) => {
          if (auth.currentUser?.uid !== firebaseUser.uid) return;
          const customerData = snapshot.exists() ? snapshot.data() || {} : null;
          if (customerData?.address && typeof customerData.address === "object") {
            try {
              saveActiveLocation(
                customerData.address,
                getActiveLocationStorageKey(firebaseUser.uid)
              );
            } catch (cacheError) {
              if (import.meta.env.DEV) {
                console.warn("[AUTH] Saved address was not cached:", {
                  error: cacheError?.message || String(cacheError),
                  city: customerData.address.city || "",
                  district: customerData.address.district || "",
                  state: customerData.address.state || "",
                  country: customerData.address.country || "",
                });
              }
            }
          }
          if (import.meta.env.DEV) {
            console.debug("[AUTH DEBUG] customer snapshot address refreshed", {
              documentExists: snapshot.exists(),
              city: customerData?.address?.city || "",
              district: customerData?.address?.district || "",
              state: customerData?.address?.state || "",
              country: customerData?.address?.country || "",
              hasCoordinates: Boolean(
                customerData?.address?.lat != null
                && customerData?.address?.lon != null
              ),
            });
          }
          setCustomer(customerData
            ? { ...customerData, uid: firebaseUser.uid }
            : null);
          setCustomerError("");
          setLoading(false);
        },
        (error) => {
          console.error("[AUTH] Customer profile listener failed:", error);
          if (auth.currentUser?.uid === firebaseUser.uid) {
            setCustomer(null);
            setCustomerError("We couldn't load your saved location. Please try again.");
            setLoading(false);
          }
        }
      );
    });

    return () => {
      unsubscribeCustomer();
      unsubscribeAuth();
    };
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      customer,
      customerError,
      loading,
      updateCustomerAddress,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
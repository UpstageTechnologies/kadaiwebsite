import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, firebaseCustomerDoc, onSnapshot } from "../services/firebase";

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
          setCustomer(snapshot.exists()
            ? { ...snapshot.data(), uid: firebaseUser.uid }
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
    <AuthContext.Provider value={{ user, customer, customerError, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
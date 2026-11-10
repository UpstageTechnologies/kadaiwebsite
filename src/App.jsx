
import { BrowserRouter } from "react-router-dom";
import { CartProvider } from "./components/CardContext";
import CartSummary from "./components/CartSummary";
import ScrollToTop from "./components/ScrollToTop";
import NotificationListener from "./components/NotificationListener";
import { AuthProvider } from "./components/AuthContext";
import { LocationProvider } from "./components/LocationContext";
import RootNavigator from "./navigation/root.navigator";
import { RestaurantCartProvider } from "./features/restaurants";
import "./styles/global.css";

const App = () => {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <NotificationListener />
        <CartProvider>
          <RestaurantCartProvider>
            <LocationProvider>
              <RootNavigator />
              <CartSummary />
            </LocationProvider>
          </RestaurantCartProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;

import { BrowserRouter } from "react-router-dom";
import { CartProvider } from "./components/CardContext";
import CartSummary from "./components/CartSummary";
import ScrollToTop from "./components/ScrollToTop";
import NotificationListener from "./components/NotificationListener";
import { LocationProvider } from "./components/LocationContext";
import RootNavigator from "./navigation/root.navigator";
import "./styles/global.css";

const App = () => {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <NotificationListener />

      <CartProvider>
        <LocationProvider>
          <RootNavigator />
          <CartSummary />
        </LocationProvider>
      </CartProvider>
    </BrowserRouter>
  );
};

export default App;
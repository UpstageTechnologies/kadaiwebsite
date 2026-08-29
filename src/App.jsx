
import { BrowserRouter } from "react-router-dom";
import { CartProvider } from "./components/CardContext";
import ScrollToTop from "./components/ScrollToTop";
import RootNavigator from "./navigation/root.navigator";
import "./styles/global.css";

const App = () => {
  return (
    <BrowserRouter>
      <ScrollToTop />

      <CartProvider>
        <RootNavigator />
      </CartProvider>
    </BrowserRouter>
  );
};

export default App;
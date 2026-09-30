                                                                                                                                                                      import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getCurrentCustomerId } from "../features/orders/orders.service";
import { initializeWebNotifications } from "../services/notification.service";

const NotificationListener = () => {
  const navigate = useNavigate();
  const [, setAuthVersion] = useState(0);
  const uid = getCurrentCustomerId();

  useEffect(() => {
    const handleAuthChange = () => setAuthVersion((version) => version + 1);
    window.addEventListener("kadai-auth-changed", handleAuthChange);

    return () => window.removeEventListener("kadai-auth-changed", handleAuthChange);
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    let active = true;

    initializeWebNotifications({ uid, navigate }).then((cleanup) => {
      if (active) {
        unsubscribe = cleanup;
      } else {
        cleanup();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate, uid]);

  return null;
};

export default NotificationListener;
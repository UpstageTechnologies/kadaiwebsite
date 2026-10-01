                                                                                                                                                                      import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "./AuthContext";
import { initializeWebNotifications } from "../services/notification.service";

const NotificationListener = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid || "";

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
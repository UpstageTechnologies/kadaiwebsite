import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../services/firebase";
import { initializeWebNotifications } from "../services/notification.service";

const NotificationListener = () => {
  const navigate = useNavigate();
  const [uid, setUid] = useState("");

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (firebaseUser) => setUid(firebaseUser?.uid || ""));
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

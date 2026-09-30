import { signOut } from "firebase/auth";
import { auth } from "./firebase";

export const logoutUser = () => auth ? signOut(auth) : Promise.resolve();

export const getCurrentUser = () => auth?.currentUser || null;

export const isAuthenticated = () => Boolean(auth?.currentUser?.uid);

export const getUserFullName = () => {
  const user = getCurrentUser();
  return user?.displayName || "";
};

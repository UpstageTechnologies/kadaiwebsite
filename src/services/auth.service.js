const STORAGE_KEYS = {
  IS_LOGGED_IN: "isLoggedIn",
  REGISTERED_USER: "registeredUser",
  REMEMBERED_EMAIL: "rememberedEmail",
};

export const logoutUser = () => {
  localStorage.removeItem(STORAGE_KEYS.IS_LOGGED_IN);
  localStorage.removeItem(STORAGE_KEYS.REGISTERED_USER);
};

export const getCurrentUser = () => {
  try {
    if (localStorage.getItem(STORAGE_KEYS.IS_LOGGED_IN) !== "true") return null;
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.REGISTERED_USER) || "null");
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
};

export const isAuthenticated = () => localStorage.getItem(STORAGE_KEYS.IS_LOGGED_IN) === "true";

export const getUserFullName = () => {
  const user = getCurrentUser();
  return user?.fullName || user?.name || user?.username || "";
};

export const saveRememberedEmail = (email) => {
  if (email) localStorage.setItem(STORAGE_KEYS.REMEMBERED_EMAIL, email);
};

export const getRememberedEmail = () => localStorage.getItem(STORAGE_KEYS.REMEMBERED_EMAIL) || "";

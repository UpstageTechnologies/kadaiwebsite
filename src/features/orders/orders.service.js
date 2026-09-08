const getOrderStorageKey = () => {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

  if (!isLoggedIn) {
    return "kadai.orders.guest";
  }

  try {
    const user = JSON.parse(localStorage.getItem("registeredUser") || "null");
    const email = user?.email?.trim().toLowerCase();
    return email ? `kadai.orders.${email}` : "kadai.orders.guest";
  } catch {
    return "kadai.orders.guest";
  }
};

export const getSavedOrders = () => {
  try {
    const savedOrders = JSON.parse(
      localStorage.getItem(getOrderStorageKey()) || "[]"
    );
    return Array.isArray(savedOrders) ? savedOrders : [];
  } catch {
    return [];
  }
};

export const saveOrder = (order) => {
  const orders = getSavedOrders();
  localStorage.setItem(
    getOrderStorageKey(),
    JSON.stringify([order, ...orders])
  );
};

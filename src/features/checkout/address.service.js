const getAddressStorageKey = () => {
  if (localStorage.getItem("isLoggedIn") !== "true") {
    return "kadai.addresses.guest";
  }

  try {
    const user = JSON.parse(localStorage.getItem("registeredUser") || "null");
    const email = user?.email?.trim().toLowerCase();
    return email ? `kadai.addresses.${email}` : "kadai.addresses.guest";
  } catch {
    return "kadai.addresses.guest";
  }
};

const SELECTED_ADDRESS_KEY = "selectedKadaiAddress";

const setSelectedAddressId = (id) => {
  if (!id) {
    localStorage.removeItem(SELECTED_ADDRESS_KEY);
    return;
  }

  localStorage.setItem(SELECTED_ADDRESS_KEY, id);
};

export const getSavedAddresses = (currentLocation) => {
  let savedAddresses = [];

  try {
    const storedAddresses = JSON.parse(
      localStorage.getItem(getAddressStorageKey()) || "[]"
    );
    savedAddresses = Array.isArray(storedAddresses) ? storedAddresses : [];
  } catch {
    // Use the empty list initialized above for malformed storage.
  }

  try {
    const user = JSON.parse(localStorage.getItem("registeredUser") || "null");
    const selectedUserAddress = user?.address;

    if (
      selectedUserAddress?.address &&
      !savedAddresses.some((address) => address.id === selectedUserAddress.id)
    ) {
      savedAddresses.unshift({
        id: selectedUserAddress.id || "saved-profile-address",
        label: selectedUserAddress.label || "Saved address",
        ...selectedUserAddress,
      });
    }
  } catch {
    // Ignore malformed legacy user data.
  }

  if (
    currentLocation?.address &&
    !savedAddresses.some(
      (address) => address.address === currentLocation.address
    )
  ) {
    savedAddresses.unshift({
      id: "current-location",
      label: "Current location",
      ...currentLocation,
    });
  }

  return savedAddresses;
};

export const selectAddress = (address) => {
  if (!address) {
    setSelectedAddressId(null);
    return;
  }

  setSelectedAddressId(address.id);

  try {
    const user = JSON.parse(localStorage.getItem("registeredUser") || "null");

    if (user) {
      localStorage.setItem(
        "registeredUser",
        JSON.stringify({ ...user, address })
      );
    }
  } catch {
    // Keep checkout usable if legacy user data is malformed.
  }
};

export const saveAddress = (address) => {
  const addresses = getSavedAddresses();
  const updatedAddresses = [
    address,
    ...addresses.filter((savedAddress) => savedAddress.id !== address.id),
  ];

  localStorage.setItem(
    getAddressStorageKey(),
    JSON.stringify(updatedAddresses)
  );
  selectAddress(address);
};

export const updateAddress = (address) => {
  const addresses = getSavedAddresses();
  const existingAddressIndex = addresses.findIndex(
    (savedAddress) => savedAddress.id === address.id
  );

  const updatedAddresses = [...addresses];

  if (existingAddressIndex >= 0) {
    updatedAddresses[existingAddressIndex] = address;
  } else {
    updatedAddresses.unshift(address);
  }

  localStorage.setItem(
    getAddressStorageKey(),
    JSON.stringify(updatedAddresses)
  );
  selectAddress(address);
};

export const deleteAddress = (addressId) => {
  const storageKey = getAddressStorageKey();
  const savedAddresses = getSavedAddresses();
  const updatedAddresses = savedAddresses.filter(
    (savedAddress) => savedAddress.id !== addressId
  );

  localStorage.setItem(storageKey, JSON.stringify(updatedAddresses));

  const selectedAddressId = localStorage.getItem("selectedKadaiAddress");
  if (selectedAddressId === addressId) {
    localStorage.removeItem("selectedKadaiAddress");
  }

  try {
    const user = JSON.parse(localStorage.getItem("registeredUser") || "null");

    if (user?.address?.id === addressId) {
      localStorage.setItem(
        "registeredUser",
        JSON.stringify({ ...user, address: null })
      );
    }
  } catch {
    // Keep checkout usable if legacy user data is malformed.
  }
};

export const getSelectedAddress = (addresses) => {
  try {
    const selectedAddressId = localStorage.getItem("selectedKadaiAddress") || "";

    if (selectedAddressId) {
      return (
        addresses.find((address) => address.id === selectedAddressId) ||
        addresses[0] ||
        null
      );
    }

    return addresses[0] || null;
  } catch {
    return addresses[0] || null;
  }
};
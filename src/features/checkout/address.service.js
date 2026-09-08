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
  localStorage.setItem("selectedKadaiAddress", JSON.stringify(address));

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

export const getSelectedAddress = (addresses) => {
  try {
    const selectedAddress = JSON.parse(
      localStorage.getItem("selectedKadaiAddress") || "null"
    );
    return (
      addresses.find((address) => address.id === selectedAddress?.id) ||
      addresses[0] ||
      null
    );
  } catch {
    return addresses[0] || null;
  }
};
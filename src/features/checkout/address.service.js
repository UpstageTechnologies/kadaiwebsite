let selectedAddressId = "";

export const getSavedAddresses = (currentLocation) => {
  const savedAddresses = [];
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
  selectedAddressId = address?.id || "";
};

export const saveAddress = (address) => {
  selectAddress(address);
};

export const updateAddress = (address) => {
  selectAddress(address);
};

export const deleteAddress = (addressId) => {
  if (selectedAddressId === addressId) selectedAddressId = "";
};

export const getSelectedAddress = (addresses) => {
  if (selectedAddressId) {
    return addresses.find((address) => address.id === selectedAddressId) || addresses[0] || null;
  }
  return addresses[0] || null;
};
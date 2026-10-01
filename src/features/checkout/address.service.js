                                                    export const getSavedAddresses = (currentLocation, customerAddress) => {
                                                      const addresses = [];
                                                      const hasCustomerAddress = customerAddress && typeof customerAddress === "object"
                                                        && !Array.isArray(customerAddress) && Object.keys(customerAddress).length > 0;

                                                      if (hasCustomerAddress) {
                                                        addresses.push({
                                                          ...customerAddress,
                                                          id: "saved-profile-address",
                                                          label: "Saved address",
                                                          address: customerAddress.fullAddress || customerAddress.address || [
                                                            customerAddress.area,
                                                            customerAddress.city,
                                                            customerAddress.district,
                                                            customerAddress.state,
                                                            customerAddress.country,
                                                            customerAddress.pincode,
                                                          ].filter(Boolean).join(", "),
                                                          latitude: customerAddress.lat ?? customerAddress.latitude,
                                                          longitude: customerAddress.lon ?? customerAddress.longitude,
                                                        });
                                                      }

                                                      if (currentLocation?.address) {
                                                        addresses.push({
                                                          id: "current-location",
                                                          label: "Current location",
                                                          ...currentLocation,
                                                        });
                                                      }

                                                      return addresses;
                                                    };

                                                    export const getSelectedAddress = (addresses) => addresses[0] || null;
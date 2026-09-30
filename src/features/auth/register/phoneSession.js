let _confirmation = null;
let registrationPhone = "";
let registrationUsername = "";

export function setConfirmation(conf, phone = "") {
  _confirmation = conf;

  if (phone) {
    registrationPhone = phone;
  }
}

export function getConfirmation() {
  return _confirmation;
}

export function clearConfirmation() {
  _confirmation = null;
}

export function getRegistrationPhone() {
  return registrationPhone;
}

export function clearRegistrationPhone() {
  registrationPhone = "";
}

export function setRegistrationUsername(username) {
  registrationUsername = username;
}

export function getRegistrationUsername() {
  return registrationUsername;
}

export function clearRegistrationUsername() {
  registrationUsername = "";
}

let _confirmation = null;
let _phone = "";
let _username = "";

export function setConfirmation(conf, phone = "") {
  _confirmation = conf;

  if (phone) {
    _phone = phone;
  }
}

export function getConfirmation() {
  return _confirmation;
}

export function clearConfirmation() {
  _confirmation = null;
}

export function getRegistrationPhone() {
  return _phone;
}

export function clearRegistrationPhone() {
  _phone = "";
}

export function setRegistrationUsername(username) {
  _username = username;
}

export function getRegistrationUsername() {
  return _username;
}

export function clearRegistrationUsername() {
  _username = "";
}
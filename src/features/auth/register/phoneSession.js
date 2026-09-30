                                                                                                     let _confirmation = null;
const PHONE_SESSION_KEY = "kadai.registration.phone";
const USERNAME_SESSION_KEY = "kadai.registration.username";

export function setConfirmation(conf, phone = "") {
  _confirmation = conf;

  if (phone) {
    sessionStorage.setItem(PHONE_SESSION_KEY, phone);
  }
}

export function getConfirmation() {
  return _confirmation;
}

export function clearConfirmation() {
  _confirmation = null;
}

export function getRegistrationPhone() {
  return sessionStorage.getItem(PHONE_SESSION_KEY) || "";
}

export function clearRegistrationPhone() {
  sessionStorage.removeItem(PHONE_SESSION_KEY);
}

export function setRegistrationUsername(username) {
  sessionStorage.setItem(USERNAME_SESSION_KEY, username);
}

export function getRegistrationUsername() {
  return sessionStorage.getItem(USERNAME_SESSION_KEY) || "";
}

export function clearRegistrationUsername() {
  sessionStorage.removeItem(USERNAME_SESSION_KEY);
}
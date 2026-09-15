let _confirmation = null;

export function setConfirmation(conf) {
  _confirmation = conf;
}

export function getConfirmation() {
  return _confirmation;
}

export function clearConfirmation() {
  _confirmation = null;
}

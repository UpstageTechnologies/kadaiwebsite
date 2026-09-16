export const normalizeLoginPhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length === 10 ? `+91${digits}` : "";
};

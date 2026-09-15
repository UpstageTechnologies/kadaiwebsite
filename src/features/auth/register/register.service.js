export const registerPhoneNumber = (phoneNumber) => phoneNumber;
export const formatPhoneForOtp = (phoneCode, phone) => `${phoneCode}${String(phone || '').replace(/\D/g, '')}`;

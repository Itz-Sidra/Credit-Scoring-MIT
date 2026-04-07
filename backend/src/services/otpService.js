// Phone OTP has been fully deprecated in favour of email OTP.
// This module is retained as a compatibility stub for any stale imports.

export const sendOTP = async () => {
  throw new Error("Phone OTP is disabled. Use sendEmailOTP instead.");
};

export const verifyOTP = async () => {
  throw new Error("Phone OTP verification is disabled. Use verifyEmailOTP instead.");
};

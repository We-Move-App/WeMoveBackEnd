const express = require("express");
const {
  sendotpToUpdatephone,
  sendOtpToPhoneHandler,
  verifyPhoneOtpHandler,
  sendOtpToEmailHandler,
  verifyEmailOtpHandler,
  refreshAccessTokenHandler,
  verifyPhoneOtpFPin,
} = require("../../../controllers/new-driver-module/auth/auth.controller");
const newDriverauthRoute = express.Router();

newDriverauthRoute.post("/send-otp-phone", sendOtpToPhoneHandler);
newDriverauthRoute.post("/send-otp-update-phone", sendotpToUpdatephone);
newDriverauthRoute.post("/verify-phone-otp", verifyPhoneOtpHandler);
newDriverauthRoute.post("/send-otp-email", sendOtpToEmailHandler);
newDriverauthRoute.post("/verify-email-otp", verifyEmailOtpHandler);
newDriverauthRoute.post("/pin-verify-otp", verifyPhoneOtpFPin);
newDriverauthRoute.post("/refresh-access-token", refreshAccessTokenHandler);

module.exports = newDriverauthRoute;

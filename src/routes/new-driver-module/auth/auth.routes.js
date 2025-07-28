const express = require("express");
const {
  sendOtpToPhoneHandler,
  verifyPhoneOtpHandler,
  sendOtpToEmailHandler,
  verifyEmailOtpHandler,
  refreshAccessTokenHandler,
} = require("../../../controllers/new-driver-module/auth/auth.controller");
const newDriverauthRoute = express.Router();

newDriverauthRoute.post("/send-otp-phone", sendOtpToPhoneHandler);
newDriverauthRoute.post("/verify-phone-otp", verifyPhoneOtpHandler);
newDriverauthRoute.post("/send-otp-email", sendOtpToEmailHandler);
newDriverauthRoute.post("/verify-email-otp", verifyEmailOtpHandler);
newDriverauthRoute.post("/refresh-access-token", refreshAccessTokenHandler);

module.exports = newDriverauthRoute;

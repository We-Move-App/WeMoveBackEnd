const express = require("express");
const {
  sendOtpEmailOrPhoneNumber,
  verifyEmailOtp,
  verifyPhoneNumberOtp,
  checkEmailorPhoneNumberIsVerified,
} = require("../../../../controllers/global-module/verifications/verifications.controllers");
const verificationRoutes = express.Router();

verificationRoutes.route("/status").get(checkEmailorPhoneNumberIsVerified);

verificationRoutes
  .route("/send-otp-email-phone")
  .post(sendOtpEmailOrPhoneNumber);

verificationRoutes.route("/verify-email-otp").put(verifyEmailOtp);

verificationRoutes.route("/verify-phone-otp").put(verifyPhoneNumberOtp);


module.exports = verificationRoutes;

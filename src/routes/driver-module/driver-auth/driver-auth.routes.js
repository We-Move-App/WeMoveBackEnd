const express = require("express");
const {
  registerUser,
  loginUser,
  registerUserWithOtp,
  verifyOTP,
  resendOtp,
  logoutUser,
  refreshToken,
  verifyStatus,
  addEmailOrPhone,
  removeDeviceTokens,
  saveDeviceTokens,
  verifyOTPWithoutAuth,
  resendOtpWithoutAuth,
  verifyEmailExist
} = require("../../../controllers/driver-module/driver-auth/driver-auth.controllers");
const { isDriverAuthenticated } = require("../../../middlewares/authDriver");

const driverAuthRoutes = express.Router();

driverAuthRoutes.route("/register-with-otp").post(registerUserWithOtp);
driverAuthRoutes.route("/login").post(loginUser);
driverAuthRoutes.route("/register").post(registerUser);
driverAuthRoutes.route("/verify-otp").post(isDriverAuthenticated, verifyOTP);
driverAuthRoutes.route("/resend-otp").post(isDriverAuthenticated, resendOtp);
driverAuthRoutes.route("/verify-otp-without-auth").post(verifyOTPWithoutAuth);
driverAuthRoutes.route("/resend-otp-without-auth").post(resendOtpWithoutAuth);
driverAuthRoutes.route("/logout").post(isDriverAuthenticated, logoutUser);
driverAuthRoutes
  .route("/refresh-token")
  .post(isDriverAuthenticated, refreshToken);
driverAuthRoutes
  .route("/verify-status")
  .get(isDriverAuthenticated, verifyStatus);
driverAuthRoutes
  .route("/update-email-phone")
  .put(isDriverAuthenticated, addEmailOrPhone);
driverAuthRoutes
  .route("/add-device-token")
  .post(isDriverAuthenticated, saveDeviceTokens);
driverAuthRoutes
  .route("/delete-device-token")
  .put(isDriverAuthenticated, removeDeviceTokens);
driverAuthRoutes.route("/check-email-exist").get(verifyEmailExist);

module.exports = driverAuthRoutes;

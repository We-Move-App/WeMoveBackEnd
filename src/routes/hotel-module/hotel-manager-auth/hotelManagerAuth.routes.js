const express = require("express");
const {
  registerHotelManager,
  loginHotelManager,
  verifyOTP,
  resendOtp,
  logoutUser,
  refreshToken,
  verifyStatus,
  addEmailOrPhone,
  removeDeviceTokens,
  saveDeviceTokens,
  verifyOTPWithoutToken,
  resendOtpWithoutToken,
  verifyEmailExist
} = require("../../../controllers/hotel-module/hotel-manager-auth/hotel-manager-auth.controller");
const {
  isHotelManagerAuthenticated,
} = require("../../../middlewares/authHotelManager");

const hotelManagerAuthRoutes = express.Router();

hotelManagerAuthRoutes.route("/register").post(registerHotelManager);
hotelManagerAuthRoutes.route("/login").post(loginHotelManager);
hotelManagerAuthRoutes
  .route("/verify-otp")
  .post(isHotelManagerAuthenticated, verifyOTP);
hotelManagerAuthRoutes
  .route("/resend-otp")
  .post(isHotelManagerAuthenticated, resendOtp);
hotelManagerAuthRoutes
  .route("/logout")
  .post(isHotelManagerAuthenticated, logoutUser);
hotelManagerAuthRoutes.route("/refresh-token").post(refreshToken);
hotelManagerAuthRoutes
  .route("/verify-status")
  .get(isHotelManagerAuthenticated, verifyStatus);
hotelManagerAuthRoutes
  .route("/update-email-phone")
  .put(isHotelManagerAuthenticated, addEmailOrPhone);
hotelManagerAuthRoutes
  .route("/add-device-token")
  .post(isHotelManagerAuthenticated, saveDeviceTokens);
hotelManagerAuthRoutes
  .route("/delete-device-token")
  .put(isHotelManagerAuthenticated, removeDeviceTokens);
hotelManagerAuthRoutes
  .route("/verify-otp-without-auth")
  .post(verifyOTPWithoutToken);
hotelManagerAuthRoutes
  .route("/resend-otp-without-auth")
  .post(resendOtpWithoutToken);
hotelManagerAuthRoutes.route("/check-email-exist").get(verifyEmailExist);

module.exports = hotelManagerAuthRoutes;

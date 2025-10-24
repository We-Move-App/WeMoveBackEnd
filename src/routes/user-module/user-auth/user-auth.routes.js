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
  saveDeviceTokens,
  removeDeviceTokens,
  verifyOTPWithoutAuth,
  resendOtpWithoutAuth,
  verifyEmailExist
} = require("../../../controllers/user-module/user-auth/user-auth.controllers");
const { isUserAuthenticated } = require("../../../middlewares/authUser");
const authDeviceToken = require("../../../middlewares/authDeviceToken");

const userAuthRoutest = express.Router();

// userAuthRoutest.route("/register-with-otp").post(registerUserWithOtp);
userAuthRoutest.route("/register-with-otp").post(registerUserWithOtp);
userAuthRoutest.route("/login").post(loginUser);
userAuthRoutest.route("/register").post(registerUser);
userAuthRoutest.route("/verify").post(verifyOTP);
userAuthRoutest.route("/resend-otp").post(isUserAuthenticated, resendOtp);
userAuthRoutest.route("/verify-otp-without-auth").post(verifyOTPWithoutAuth);
userAuthRoutest.route("/resend-otp-without-auth").post(resendOtpWithoutAuth);
userAuthRoutest.route("/logout").post(isUserAuthenticated, logoutUser);
userAuthRoutest.route("/refresh-token").post(refreshToken);
userAuthRoutest.route("/verify-status").get(isUserAuthenticated, verifyStatus);
userAuthRoutest
  .route("/update-email-phone")
  .put(isUserAuthenticated, addEmailOrPhone);
userAuthRoutest
  .route("/add-device-token")
  .post(isUserAuthenticated, saveDeviceTokens);
userAuthRoutest
  .route("/delete-device-token")
  .put(isUserAuthenticated, removeDeviceTokens);
userAuthRoutest
  .route("/delete-device-token")
  .put(isUserAuthenticated, removeDeviceTokens);
userAuthRoutest
  .route("/check-email-exist")
  .get(verifyEmailExist);

module.exports = userAuthRoutest;

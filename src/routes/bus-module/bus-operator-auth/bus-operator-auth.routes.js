const express = require("express");
const {
  registerBusOperator,
  loginBusOperator,
  verifyOTP,
  resendOtp,
  logoutUser,
  refreshToken,
  verifyStatus,
  addEmailOrPhone,
  removeDeviceTokens,
  saveDeviceTokens,
  verificationBusOperator,
  getVerificationDetails,
  updateVerificationDetails,
  verifyOTPWithoutToken,
  resendOtpWithoutToken,
  verifyEmailExist
} = require("../../../controllers/bus-module/bus-operator-auth/bus-operator-auth.controllers");
const {
  isBusOperatorAuthenticated,
} = require("../../../middlewares/authBusOperator");
const { uploadDocuments } = require("../../../utils/uploadFiles/multer");

const busOperatorAuthRoutes = express.Router();

busOperatorAuthRoutes.route("/register").post(registerBusOperator);
busOperatorAuthRoutes.route("/login").post(loginBusOperator);

busOperatorAuthRoutes
  .route("/verify-otp")
  .post(isBusOperatorAuthenticated, verifyOTP);

busOperatorAuthRoutes
  .route("/verify-otp-without-auth")
  .post(verifyOTPWithoutToken);

busOperatorAuthRoutes
  .route("/resend-otp")
  .post(isBusOperatorAuthenticated, resendOtp);

busOperatorAuthRoutes
  .route("/resend-otp-without-auth")
  .post(resendOtpWithoutToken);

busOperatorAuthRoutes
  .route("/logout")
  .post(isBusOperatorAuthenticated, logoutUser);

busOperatorAuthRoutes.route("/refresh-token").post(refreshToken);

busOperatorAuthRoutes
  .route("/verify-status")
  .get(isBusOperatorAuthenticated, verifyStatus);

busOperatorAuthRoutes
  .route("/update-email-phone")
  .put(isBusOperatorAuthenticated, addEmailOrPhone);

busOperatorAuthRoutes
  .route("/verify-details")
  .put(isBusOperatorAuthenticated, uploadDocuments, verificationBusOperator);

busOperatorAuthRoutes
  .route("/get-verification-details")
  .get(isBusOperatorAuthenticated, getVerificationDetails);

busOperatorAuthRoutes
  .route("/update-verification-details")
  .put(isBusOperatorAuthenticated, uploadDocuments, updateVerificationDetails);

busOperatorAuthRoutes
  .route("/add-device-token")
  .post(isBusOperatorAuthenticated, saveDeviceTokens);

busOperatorAuthRoutes
  .route("/delete-device-token")
  .put(isBusOperatorAuthenticated, removeDeviceTokens);

busOperatorAuthRoutes
  .route("/check-email-exist")
  .get(verifyEmailExist);

module.exports = busOperatorAuthRoutes;

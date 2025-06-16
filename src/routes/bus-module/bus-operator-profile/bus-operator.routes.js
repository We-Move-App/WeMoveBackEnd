const express = require("express");

const {
  getProfile,
  getAvatar,
  updateYourProfile,
  changePassword,
  setPassword,
  resetPassword,
  updateAvatar,
  deleteAccount,
  assignBranch,
  resetPassword2,
} = require("../../../controllers/bus-module/bus-operators/bus-operator-profile.controllers");
const {
  uploadDocuments,
  uploadAvatar,
} = require("../../../utils/uploadFiles/multer");
const {
  isBusOperatorAuthenticated,
} = require("../../../middlewares/authBusOperator");

const busOperatorRoutes = express.Router();

busOperatorRoutes.route("/profile").get(isBusOperatorAuthenticated, getProfile);

busOperatorRoutes
  .route("/get-avatar")
  .get(isBusOperatorAuthenticated, getAvatar);

busOperatorRoutes
  .route("/update-profile")
  .put(isBusOperatorAuthenticated, uploadDocuments, updateYourProfile);

busOperatorRoutes
  .route("/change-password")
  .put(isBusOperatorAuthenticated, changePassword);

busOperatorRoutes
  .route("/set-password")
  .put(isBusOperatorAuthenticated, setPassword);

busOperatorRoutes
  .route("/reset-password")
  .put(isBusOperatorAuthenticated, resetPassword);

busOperatorRoutes.route("/reset-password-new").put(resetPassword2);

busOperatorRoutes
  .route("/update-avatar")
  .put(isBusOperatorAuthenticated, uploadAvatar, updateAvatar);

busOperatorRoutes
  .route("/delete-account")
  .delete(isBusOperatorAuthenticated, deleteAccount);

busOperatorRoutes
  .route("/assign-branch")
  .put(isBusOperatorAuthenticated, assignBranch);

module.exports = busOperatorRoutes;

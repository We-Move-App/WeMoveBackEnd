const express = require("express");

const {
  getProfile,
  getAvatar,
  updateYourProfile,
  changePassword,
  setPassword,
  resetPassword,
  updateAvatar,
  assignBranch,
  resetPassword2
} = require("../../../controllers/driver-module/drivers/drivers.controllers");

const {
  uploadDocuments,
  uploadAvatar,
} = require("../../../utils/uploadFiles/multer");
const { isDriverAuthenticated } = require("../../../middlewares/authDriver");

const driverRoutes = express.Router();

driverRoutes.route("/profile").get(isDriverAuthenticated, getProfile);

driverRoutes.route("/get-avatar").get(isDriverAuthenticated, getAvatar);

driverRoutes
  .route("/update-profile")
  .put(isDriverAuthenticated, uploadDocuments, updateYourProfile);

driverRoutes
  .route("/change-password")
  .put(isDriverAuthenticated, changePassword);

driverRoutes.route("/set-password").put(isDriverAuthenticated, setPassword);

driverRoutes.route("/reset-password").put(isDriverAuthenticated, resetPassword);

driverRoutes.route("/reset-password-without-auth").put(resetPassword2);

driverRoutes.route("/assign-branch").put(isDriverAuthenticated, assignBranch);


driverRoutes
  .route("/update-avatar")
  .put(isDriverAuthenticated, uploadAvatar, updateAvatar);

module.exports = driverRoutes;

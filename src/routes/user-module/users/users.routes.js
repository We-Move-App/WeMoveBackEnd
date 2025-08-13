const express = require("express");

const {
  getBeneficiary,
  getProfile,
  getAvatar,
  updateYourProfile,
  changePassword,
  setPassword,
  resetPassword,
  updateAvatar,
  assignBranch,
  resetPassword2
} = require("../../../controllers/user-module/users/users.controllers");
const { isUserAuthenticated } = require("../../../middlewares/authUser");
const {
  uploadDocuments,
  uploadAvatar,
} = require("../../../utils/uploadFiles/multer");

const userRoutes = express.Router();

userRoutes.route("/profile").get(isUserAuthenticated, getProfile);
userRoutes.route("/get-avatar").get(isUserAuthenticated, getAvatar);

userRoutes
  .route("/update-profile")
  .put(isUserAuthenticated, uploadDocuments, updateYourProfile);

userRoutes.route("/change-password").put(isUserAuthenticated, changePassword);

userRoutes.route("/set-password").put(isUserAuthenticated, setPassword);

userRoutes.route("/assign-branch").put(isUserAuthenticated, assignBranch);

userRoutes.route("/reset-password").put(isUserAuthenticated, resetPassword);
userRoutes.route("/reset-password-without-auth").put(resetPassword2);
userRoutes.route("/beneficiary").post(getBeneficiary);

userRoutes
  .route("/update-avatar")
  .put(isUserAuthenticated, uploadAvatar, updateAvatar);

module.exports = userRoutes;

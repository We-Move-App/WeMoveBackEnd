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
  resetPassword2,
  getAvailableModules,
  deleteProfile,
} = require("../../../controllers/user-module/users/users.controllers");
const { addMemberUnderUser } = require("../../../controllers/user-module/userMember/userMember.Controllers");
const { isUserAuthenticated } = require("../../../middlewares/authUser");
const {
  uploadDocuments,
  uploadAvatar,
} = require("../../../utils/uploadFiles/multer");
const authDeviceToken = require("../../../middlewares/authDeviceToken");
const userRoutes = express.Router();

userRoutes.route("/profile").get(isUserAuthenticated, authDeviceToken, getProfile);
userRoutes.route("/get-avatar").get(isUserAuthenticated, authDeviceToken, getAvatar);
userRoutes
  .route("/update-profile")
  .put(isUserAuthenticated, authDeviceToken, uploadDocuments, updateYourProfile);


userRoutes.route("/change-password").put(isUserAuthenticated, authDeviceToken, changePassword);

userRoutes.route("/set-password").put(isUserAuthenticated, authDeviceToken, setPassword);

userRoutes.route("/assign-branch").put(isUserAuthenticated, authDeviceToken, assignBranch);

userRoutes.route("/reset-password").put(isUserAuthenticated, authDeviceToken, resetPassword);
userRoutes.route("/reset-password-without-auth").put(resetPassword2);
userRoutes.route("/beneficiary").post(getBeneficiary);
userRoutes.route("/available-modules").get(getAvailableModules);
userRoutes.route("/delete-profile").delete(deleteProfile);

userRoutes
  .route("/update-avatar")
  .put(isUserAuthenticated, authDeviceToken, uploadAvatar, updateAvatar);

module.exports = userRoutes;

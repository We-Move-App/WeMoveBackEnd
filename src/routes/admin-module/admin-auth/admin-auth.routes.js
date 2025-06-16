const express = require("express");
const { isAdminAuthenticated } = require("../../../middlewares/authAdmins");
const {
  addAdmins,
  loginAdmin,
  removeDeviceTokens,
  saveDeviceTokens,
  getAllAdmins,
  getAdminById,
  getProfile,
  updateAvatar,
  changePassword,
  resetPassword,
} = require("../../../controllers/admin-module/admin-auth/admin-auth.controllers");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");
const { uploadDocuments } = require("../../../utils/uploadFiles/multer");
const adminAuthRoutes = express.Router();

adminAuthRoutes
  .route("/add-admin")
  .post(isAdminAuthenticated, authorizeRole(["SuperAdmin"]), addAdmins);

adminAuthRoutes.route("/login").post(loginAdmin);

adminAuthRoutes
  .route("/all-admins")
  .get(isAdminAuthenticated, authorizeRole(["SuperAdmin"]), getAllAdmins);

adminAuthRoutes
  .route("/details/:id")
  .get(isAdminAuthenticated, authorizeRole(["SuperAdmin"]), getAdminById);

adminAuthRoutes
  .route("/my-profile")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    getProfile
  );

adminAuthRoutes
  .route("/add-avatar")
  .put(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    uploadDocuments,
    updateAvatar
  );

adminAuthRoutes
  .route("/change-password")
  .put(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    changePassword
  );

adminAuthRoutes
  .route("/reset-password")
  .put(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    resetPassword
  );

adminAuthRoutes
  .route("/add-device-token")
  .post(isAdminAuthenticated, saveDeviceTokens);

adminAuthRoutes
  .route("/delete-device-token")
  .put(isAdminAuthenticated, removeDeviceTokens);

module.exports = {
  adminAuthRoutes,
};

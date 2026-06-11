const express = require("express");
const { isAdminAuthenticated } = require("../../../middlewares/authAdmins");
const {
  addAdmins,
  addSubAdmins,
  loginAdmin,
  removeDeviceTokens,
  saveDeviceTokens,
  getAllAdmins,
  getAdminById,
  getProfile,
  getAvatar,
  updateAvatar,
  changePassword,
  resetPassword,
  createSuperAdmin,
  updateAdmin,
  updateSubAdmin,
  getUserActivities,
  createCoupon,
  getCouponById,
  updateCoupon,
  updateCouponStatus,
  getAllCoupons,
  getSubAdminsByBranch,
  getTransactionHistory,
  adminAuthSendOtp,
  adminAuthVerifyOtp,
  adminResetPassword,
  adminUpdatePassword,
  changeLn,
} = require("../../../controllers/admin-module/admin-auth/admin-auth.controllers");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");

const {
  uploadDocuments,
  uploadAvatar,
} = require("../../../utils/uploadFiles/multer");
const { Admin } = require("mongodb");
const adminAuthRoutes = express.Router();

adminAuthRoutes
  .route("/add-admin")
  .post(isAdminAuthenticated, authorizeRole(["SuperAdmin"]), addAdmins);

adminAuthRoutes
  .route("/add-Subadmin")
  .post(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin"]),
    addSubAdmins
  );

adminAuthRoutes.route("/login").post(loginAdmin);

adminAuthRoutes
  .route("/all-admins")
  .get(isAdminAuthenticated, authorizeRole(["SuperAdmin"]), getAllAdmins);

adminAuthRoutes
  .route("/all-Subadmins")
  .get(isAdminAuthenticated, authorizeRole(["Admin"]), getSubAdminsByBranch);

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
  .route("/avtatar")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    getAvatar
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

adminAuthRoutes.route("/").post(createSuperAdmin);

adminAuthRoutes
  .route("/updateAdmin/:adminId")
  .put(isAdminAuthenticated, authorizeRole(["SuperAdmin "]), updateAdmin);

adminAuthRoutes
  .route("/updateSubAdmin/:adminId")
  .put(
    isAdminAuthenticated,
    authorizeRole(["  SuperAdmin", "Admin"]),
    updateSubAdmin
  );
adminAuthRoutes
  .route("/activity/:userId")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    getUserActivities
  );
adminAuthRoutes
  .route("/create-coupon")
  .post(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin"]),
    createCoupon
  );

adminAuthRoutes
  .route("/update-coupon/:couponId")
  .put(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin"]),
    updateCoupon
  );

adminAuthRoutes
  .route("/update-couponStatus/:couponId")
  .put(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin"]),
    updateCouponStatus
  );

adminAuthRoutes
  .route("/get-coupon/:id")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin"]),
    getCouponById
  );

adminAuthRoutes
  .route("/all-coupons")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin"]),
    getAllCoupons
  );

adminAuthRoutes
  .route("/getAlltransactions")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "addSubAdmins"]),
    getTransactionHistory
  );

adminAuthRoutes.route("/send-email-otp").post(adminAuthSendOtp);

adminAuthRoutes.route("/verify-email-otp").post(adminAuthVerifyOtp);

adminAuthRoutes.route("/reset-password").post(adminResetPassword);

adminAuthRoutes
  .route("/update-password")
  .post(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "addSubAdmins"]),
    adminUpdatePassword
  );

adminAuthRoutes
  .route("/change-ln")
  .post(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "addSubAdmins"]),
    changeLn
  );

module.exports = {
  adminAuthRoutes,
};

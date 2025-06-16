const express = require("express");
const { isAdminAuthenticated } = require("../../../middlewares/authAdmins");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");
const {
  getAllDrivers,
  getSingleUser,
  verifyUserProfile,
} = require("../../../controllers/admin-module/driver-management/admin-drivers.controllers");
const adminDriverManagementRoutes = express.Router();

adminDriverManagementRoutes
  .route("/drivers")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin"]),
    getAllDrivers
  );

adminDriverManagementRoutes
  .route("/drivers/:userId")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    getSingleUser
  );
adminDriverManagementRoutes
  .route("/drivers/verify/:userId")
  .put(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    verifyUserProfile
  );

module.exports = {
  adminDriverManagementRoutes,
};

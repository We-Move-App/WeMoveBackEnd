const express = require("express");
const { isAdminAuthenticated } = require("../../../middlewares/authAdmins");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");
const {
  getAllUsers,
  getSingleUser,
  verifyUserProfile,
} = require("../../../controllers/admin-module/user-management/admin-users.controlllers");
const adminUserManagementRoutes = express.Router();

adminUserManagementRoutes
  .route("/users")
  .get(isAdminAuthenticated, authorizeRole(["SuperAdmin", "Admin"]), getAllUsers);

adminUserManagementRoutes
  .route("/users/:userId")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    getSingleUser
  );

adminUserManagementRoutes
  .route("/users/verify/:userId")
  .put(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    verifyUserProfile
  );

module.exports = {
  adminUserManagementRoutes,
};

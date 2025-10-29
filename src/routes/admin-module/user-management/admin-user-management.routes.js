const express = require("express");
const { isAdminAuthenticated } = require("../../../middlewares/authAdmins");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");
const {
  getAllUsers,
  getSingleUser,
  verifyUserProfile,
  getAllUsersBookings,

} = require("../../../controllers/admin-module/user-management/admin-users.controlllers");
const adminUserManagementRoutes = express.Router();

adminUserManagementRoutes
  .route("/users")
  .get(isAdminAuthenticated, authorizeRole(["SuperAdmin", "Admin"]), getAllUsers);

adminUserManagementRoutes
  .route("/users/:_id")
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


adminUserManagementRoutes
  .route("/bookings")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    getAllUsersBookings
  );

module.exports = {
  adminUserManagementRoutes,
};

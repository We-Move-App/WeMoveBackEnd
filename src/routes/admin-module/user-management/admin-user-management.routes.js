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
  getAllBookingsByUserId,
  getWalletBalance,
} = require("../../../controllers/admin-module/user-management/admin-users.controlllers");
const { cacheMiddleware } = require("../../../middlewares/redisMiddleware");
const adminUserManagementRoutes = express.Router();

adminUserManagementRoutes
  .route("/users")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin"]),
    cacheMiddleware(120),
    getAllUsers
  );

adminUserManagementRoutes
  .route("/users/:_id")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    cacheMiddleware(120),
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
    cacheMiddleware(120),
    getAllUsersBookings
  );

adminUserManagementRoutes.route("/bookings/:userId").get(
  isAdminAuthenticated,
  authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
  // cacheMiddleware(120),
  getAllBookingsByUserId
);

adminUserManagementRoutes
  .route("/wallet/:userId")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    cacheMiddleware(60),
    getWalletBalance
  );

module.exports = {
  adminUserManagementRoutes,
};

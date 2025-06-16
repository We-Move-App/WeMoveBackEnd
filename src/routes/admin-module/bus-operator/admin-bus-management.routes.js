const express = require("express");
const { isAdminAuthenticated } = require("../../../middlewares/authAdmins");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");

const {
  getAllBusOperators,
  getSingleUser,
  verifyUserProfile,
  deleteBusOperatorAccount
} = require("../../../controllers/admin-module/bus-management/admin-bus-management.controllers");
const adminBusManagementRoutes = express.Router();

adminBusManagementRoutes
  .route("/bus-operators")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin"]),
    getAllBusOperators
  );
adminBusManagementRoutes
  .route("/bus-operators/:userId")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    getSingleUser
  );
adminBusManagementRoutes
  .route("/bus-operators/verify/:userId")
  .put(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    verifyUserProfile
  );

adminBusManagementRoutes
  .route("/bus-operators/delete-account/:userId")
  .delete(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    deleteBusOperatorAccount
  );

module.exports = {
  adminBusManagementRoutes,
};

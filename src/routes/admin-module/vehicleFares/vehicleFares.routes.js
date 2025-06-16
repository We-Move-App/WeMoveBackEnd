const express = require("express");
const { isAdminAuthenticated } = require("../../../middlewares/authAdmins");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");
const {
    getVehicleFares
} = require("../../../controllers/admin-module/user-management/admin-users.controlllers");
const adminVehicleFareRoutes = express.Router();

// adminVehicleFareRoutes
//   .route("/")
//   .get(isAdminAuthenticated, authorizeRole(["SuperAdmin", "Admin"]), getVehicleFares);

// adminVehicleFareRoutes
//   .route("/")
//   .post(
//     isAdminAuthenticated,
//     authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
//     updateVehicleFare
//   );

module.exports = {
  adminVehicleFareRoutes,
};

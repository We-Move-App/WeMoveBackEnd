const express = require("express");
const { isAdminAuthenticated } = require("../../../middlewares/authAdmins");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");
const {
  getAllDrivers,
  getdriverDetailsById,
  verifyUserProfile,
  createBikeDriverFromAdmin,
  updateBikeDriverByAdmin,
  createTaxiDriverFromAdmin,
  updateTaxiDriverByAdmin,
  getTaxiDriverDetailsById,
   getAllBikeBookings,
   getBookingDetailsById
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
  .route("/bike-drivers/:driverId")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    getdriverDetailsById
  );
adminDriverManagementRoutes
  .route("/taxi-drivers/:driverId")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    getTaxiDriverDetailsById
  );
adminDriverManagementRoutes
  .route("/drivers/verify/:driverId")
  .put(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    verifyUserProfile
  );
adminDriverManagementRoutes
  .route("/bike-drivers/register")
  .post(isAdminAuthenticated,
  authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
  createBikeDriverFromAdmin)

adminDriverManagementRoutes
  .route("/bike-drivers/:driverId")
  .put(isAdminAuthenticated, authorizeRole(["superAdmin", "Admin", "subAdmin"]),
    updateBikeDriverByAdmin)
adminDriverManagementRoutes
  .route("/taxi-drivers/register")
  .post(isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    createTaxiDriverFromAdmin,)

adminDriverManagementRoutes
  .route("/taxi-drivers/:driverId")
  .put(isAdminAuthenticated, authorizeRole(["superAdmin", "Admin", "subAdmin"]),
    updateTaxiDriverByAdmin,
  )
adminDriverManagementRoutes
.route("/booking/allBookings")
 .get(isAdminAuthenticated, authorizeRole(["superAdmin", "Admin", "subAdmin"]),
 getAllBikeBookings)

 adminDriverManagementRoutes
  .route("/bookingDetails/:bookingId")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    getBookingDetailsById
  );




module.exports = {
  adminDriverManagementRoutes,
};

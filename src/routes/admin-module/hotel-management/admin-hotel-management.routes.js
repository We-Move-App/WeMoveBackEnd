const express = require("express");
const { isAdminAuthenticated } = require("../../../middlewares/authAdmins");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");
const {
  getHotelByManagerId,
  getAllHotelManagers,
  getSingleUser,
  verifyUserProfile,
  searchHotelManagers}
 = require("../../../controllers/admin-module/hotel-management/admin-hotel-management.controllers");
const adminHotelManagementRoutes = express.Router();

adminHotelManagementRoutes
  .route("/hotel-managers")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    getAllHotelManagers
  );

adminHotelManagementRoutes
  .route("/hotel-managers/:userId")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    getSingleUser
  );

adminHotelManagementRoutes
  .route("/hotel-managers/verify/:userId")
  .put(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    verifyUserProfile
  );

  adminHotelManagementRoutes
  .route("/hotel-managers/hotel/search-hotel-managers")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    searchHotelManagers
  );

 adminHotelManagementRoutes
  .route("/hotel-managers/hotel/:ownerId")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    getHotelByManagerId 
  );


module.exports = {
  adminHotelManagementRoutes,
};

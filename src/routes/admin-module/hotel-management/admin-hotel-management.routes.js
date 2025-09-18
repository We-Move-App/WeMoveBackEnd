const express = require("express");
const { isAdminAuthenticated } = require("../../../middlewares/authAdmins");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");
const {
  uploadDocuments,
  uploadAvatar,
  uploadHotelManagerFiles,
} = require("../../../utils/uploadFiles/multer");
const {
  registerHotelManagerFromAdmin,
  updateHotelManagerFromAdmin,
  getHotelByManagerId,
  getAllHotelManagers,
  getSingleUser,
  verifyUserProfile,
  getAllHotelBookings,
  getBookingDetailsById,
  searchHotelBookings,
  searchHotelManagers,
} = require("../../../controllers/admin-module/hotel-management/admin-hotel-management.controllers");
const adminHotelManagementRoutes = express.Router();

adminHotelManagementRoutes
  .route("/hotel-managers/register")
  .post(
    isAdminAuthenticated,
    uploadHotelManagerFiles,
    authorizeRole(["SuperAdmin", "Admin"]),
    registerHotelManagerFromAdmin
  );
adminHotelManagementRoutes
  .route("/hotel-managers")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    getAllHotelManagers
  );

adminHotelManagementRoutes
  .route("/hotel-managers/:managerId")
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
adminHotelManagementRoutes
  .route("/hotel-manager/update/:managerId")
  .put(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    updateHotelManagerFromAdmin
  );

adminHotelManagementRoutes
  .route("/hotel-booking-details")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    getAllHotelBookings
  );
adminHotelManagementRoutes
  .route("/booking-details/:bookingId")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    getBookingDetailsById
  );
adminHotelManagementRoutes
  .route("/searchHotelBooking")
  .get(
    isAdminAuthenticated,
    authorizeRole(["SuperAdmin", "Admin", "SubAdmin"]),
    searchHotelBookings
  );

module.exports = {
  adminHotelManagementRoutes,
};

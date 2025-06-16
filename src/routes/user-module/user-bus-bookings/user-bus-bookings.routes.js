const express = require("express");
const { isUserAuthenticated } = require("../../../middlewares/authUser");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");
const {
  getUserBusBookings,
  createBusBooking,
  getBusBookingDetails,
  payBusBookingPayment,
  cancelBusBooking
} = require("../../../controllers/user-module/user-bus-bookings/user-bus-bookings.controllers");

const userBusBookingsRoutes = express.Router();

// User Routes
userBusBookingsRoutes
  .route("/my-bookings")
  .get(isUserAuthenticated, authorizeRole(["user"]), getUserBusBookings);

// Bus Operator Routes
userBusBookingsRoutes
  .route("/")
  .post(isUserAuthenticated, authorizeRole(["user"]), createBusBooking);

userBusBookingsRoutes
  .route("/pay/:bookingId")
  .put(isUserAuthenticated, payBusBookingPayment);

userBusBookingsRoutes
  .route("/cancel/:bookingId")
  .put(isUserAuthenticated, cancelBusBooking);

userBusBookingsRoutes
  .route("/:bookingId")
  .get(isUserAuthenticated, authorizeRole(["user"]), getBusBookingDetails);

module.exports = userBusBookingsRoutes;

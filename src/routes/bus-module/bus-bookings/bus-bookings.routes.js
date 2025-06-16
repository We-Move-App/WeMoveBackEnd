const express = require("express");
const {
  isBusOperatorAuthenticated,
} = require("../../../middlewares/authBusOperator");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");
const {
  getAllBusBookings,
  createBusBooking,
  getBusBookingDetails,
  updateBooking,
  cancelBooking,
  searchBuses,
} = require("../../../controllers/bus-module/bus-bookings/bus-bookings.controllers");

const busOperatorBusBookings = express.Router();

busOperatorBusBookings
  .route("/")
  .get(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    getAllBusBookings
  );
busOperatorBusBookings
  .route("/search-routes")
  .get(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    searchBuses
  );

busOperatorBusBookings
  .route("/")
  .post(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    createBusBooking
  );

busOperatorBusBookings
  .route("/:bookingId")
  .get(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    getBusBookingDetails
  );
busOperatorBusBookings
  .route("/cancel/:bookingId")
  .put(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    cancelBooking
  );

busOperatorBusBookings
  .route("/update/:bookingId")
  .put(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    updateBooking
  );

module.exports = busOperatorBusBookings;

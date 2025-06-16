const express = require("express");
const { isUserAuthenticated } = require("../../../middlewares/authUser");
const {
  getVehicleFaresForRide,
  createRide,
  getAllRides,
  getRideDetailsById,
  addRidesReview,
  cancelRideByRideId,
  userActiveRide,
} = require("../../../controllers/user-module/user-rides/user-ride-booking.controller");

const userRidesBookingRoutes = express.Router();

userRidesBookingRoutes
  .route("/get-fare")
  .get(isUserAuthenticated, getVehicleFaresForRide);
userRidesBookingRoutes
  .route("/active-ride")
  .get(isUserAuthenticated, userActiveRide);
userRidesBookingRoutes.route("/create").post(isUserAuthenticated, createRide);
userRidesBookingRoutes.route("/").get(isUserAuthenticated, getAllRides);
userRidesBookingRoutes
  .route("/:id")
  .get(isUserAuthenticated, getRideDetailsById);

userRidesBookingRoutes
  .route("/review")
  .post(isUserAuthenticated, addRidesReview);

userRidesBookingRoutes
  .route("/cancel/:id")
  .put(isUserAuthenticated, cancelRideByRideId);

// userRidesBookingRoutes.route("/pay").post(isUserAuthenticated, ridePayment);
// userRidesBookingRoutes
//   .route("/:id")
//   .get(isUserAuthenticated, getRideDetailsById);
// userRidesBookingRoutes
//   .route("/pay-refund/:rideId")
//   .put(
//     isUserAuthenticated,
//     authorizeRole("superAdmin", "admin"),
//     ridePaymentRefundAfterCancelation
//   );

module.exports = userRidesBookingRoutes;

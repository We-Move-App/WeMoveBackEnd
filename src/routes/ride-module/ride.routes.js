const express = require("express");
const rideRoutes = express.Router();

const {
  estimateRide,
  requestRide,
  cancelRideByUser,
  getUserDetailsByRideId,
  getDriverDetailsByRideId,
  verifyOtp,
  completeRide,
  rideCancelledByUser,
  rideCancelledByDriver,
  getUserActiveRide,
  getDriverActiveRide,
  getDriverAnalytics
} = require("../../controllers/ride-module/ride.controller");

rideRoutes.post("/estimate", estimateRide);
rideRoutes.post("/request", requestRide);
rideRoutes.post("/cancel-by-user/:bookingId", cancelRideByUser);
rideRoutes.get("/:rideId/ride-user-details", getUserDetailsByRideId);
rideRoutes.get("/:rideId/ride-driver-details", getDriverDetailsByRideId);
rideRoutes.post("/:rideId/verify-otp", verifyOtp);
rideRoutes.post("/:rideId/complete", completeRide);
rideRoutes.post("/:rideId/cancel-by-user", rideCancelledByUser);
rideRoutes.post("/:rideId/cancel-by-driver", rideCancelledByDriver);
rideRoutes.get("/user-active-ride", getUserActiveRide);
rideRoutes.get("/driver-active-ride", getDriverActiveRide);
rideRoutes.get("/driver-analtics", getDriverAnalytics);

module.exports = rideRoutes;

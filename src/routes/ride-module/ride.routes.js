const express = require("express");
const rideRoutes = express.Router();

const {
  estimateRide,requestRide,cancelRideByUser,getUserDetailsByRideId,getDriverDetailsByRideId
} = require("../../controllers/ride-module/ride.controller");

rideRoutes.post("/estimate", estimateRide);
rideRoutes.post("/request", requestRide);
rideRoutes.post("/cancel-by-user/:bookingId", cancelRideByUser);
rideRoutes.get("/:rideId/ride-user-details", getUserDetailsByRideId);
rideRoutes.get("/:rideId/ride-driver-details", getDriverDetailsByRideId);

module.exports=rideRoutes;
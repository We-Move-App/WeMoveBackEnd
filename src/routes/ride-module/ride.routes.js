const express = require("express");
const rideRoutes = express.Router();

const {
  estimateRide,requestRide,cancelRideByUser
} = require("../../controllers/ride-module/ride.controller");

rideRoutes.post("/estimate", estimateRide);
rideRoutes.post("/request", requestRide);
rideRoutes.post("/cancel-by-user/:bookingId", cancelRideByUser);

module.exports=rideRoutes;
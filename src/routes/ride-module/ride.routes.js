const express = require("express");
const rideRoutes = express.Router();

const {
  estimateRide,requestRide
} = require("../../controllers/ride-module/ride.controller");

rideRoutes.post("/estimate", estimateRide);
rideRoutes.post("/request", requestRide);

module.exports=rideRoutes;
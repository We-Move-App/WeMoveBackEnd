const express = require("express");
const rideRoutes = express.Router();

const {
  estimateRide,
} = require("../../controllers/ride-module/ride.controller");

rideRoutes.post("/estimate", estimateRide);

module.exports=rideRoutes;
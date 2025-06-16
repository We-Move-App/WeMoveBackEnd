const express = require("express");
const { isDriverAuthenticated } = require("../../../middlewares/authDriver");
const {
  driverActiveRide,
  getAllRides,
  getRideDetailsById,
} = require("../../../controllers/driver-module/driver-rides/driver-rides.controllers");

const driverRidesRoutes = express.Router();

driverRidesRoutes
  .route("/active-ride")
  .get(isDriverAuthenticated, driverActiveRide);

driverRidesRoutes.route("/").get(isDriverAuthenticated, getAllRides);
driverRidesRoutes.route("/:id").get(isDriverAuthenticated, getRideDetailsById);

module.exports = driverRidesRoutes;

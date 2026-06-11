const express = require("express");
const {
  getVehicleImages,
  addVehicleDetails,
  getDriverVehicleDetails,
} = require("../../../controllers/new-driver-module/vehicle-details/vehicle-details.controller");
const {
  isNDriverAuthenticated,
} = require("../../../middlewares/authNewDriver");
const vehicleDetailsRoute = express.Router();

vehicleDetailsRoute.get(
  "/vehicle-static-images",
  isNDriverAuthenticated,
  getVehicleImages
);
vehicleDetailsRoute.post(
  "/vehicle-details",
  isNDriverAuthenticated,
  addVehicleDetails
);
vehicleDetailsRoute.get(
  "/vehicle-details",
  isNDriverAuthenticated,
  getDriverVehicleDetails
);

module.exports = vehicleDetailsRoute;

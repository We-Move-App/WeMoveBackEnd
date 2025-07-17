const express = require("express");
const {
  getVehicleImages,
  addVehicleDetails,
  getDriverVehicleDetails,
} = require("../../../controllers/new-driver-module/vehicle-details/vehicle-details.controller");
const vehicleDetailsRoute = express.Router();

vehicleDetailsRoute.get("/vehicle-static-images", getVehicleImages);
vehicleDetailsRoute.post("/vehicle-details", addVehicleDetails);
vehicleDetailsRoute.get("/vehicle-details", getDriverVehicleDetails);

module.exports = vehicleDetailsRoute;

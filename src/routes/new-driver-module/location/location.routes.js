const express = require("express");
const {
  updateDriverStatus,
  getPlaceAutocomplete,
  getFromCoordinates,
  getDirection
} = require("../../../controllers/new-driver-module/location/location.controller");
const locationRouter = express.Router();

locationRouter.patch("/driver-status", updateDriverStatus);
locationRouter.get("/autocomplete", getPlaceAutocomplete);
locationRouter.get("/reverse-geocode", getFromCoordinates);
locationRouter.get("/directions", getDirection);

module.exports = locationRouter;

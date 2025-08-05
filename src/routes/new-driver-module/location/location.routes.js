const express = require("express");
const {
  updateDriverStatus,
  getPlaceAutocomplete,
  getFromCoordinates,
  getDirection,
  getPlaceDetail
} = require("../../../controllers/new-driver-module/location/location.controller");
const locationRouter = express.Router();

locationRouter.patch("/driver-status", updateDriverStatus);
locationRouter.get("/autocomplete", getPlaceAutocomplete);
locationRouter.get("/reverse-geocode", getFromCoordinates);
locationRouter.get("/directions", getDirection);
locationRouter.get("/place-details", getPlaceDetail);

module.exports = locationRouter;

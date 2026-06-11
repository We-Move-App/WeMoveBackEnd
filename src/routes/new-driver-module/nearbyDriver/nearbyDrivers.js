const express = require("express");
const { isUserAuthenticated } = require("../../../middlewares/authUser");
const {
  getNearbyActiveDrivers,
} = require("../../../controllers/new-driver-module/nearbyDrivers/nearbyDrivers");

const nearbyDriversRoutes = express.Router();

nearbyDriversRoutes.get(
  "/nearby",
  isUserAuthenticated,
  getNearbyActiveDrivers
);

module.exports = nearbyDriversRoutes;

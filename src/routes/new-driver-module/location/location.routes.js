const express = require("express");
const updateDriverStatus = require("../../../controllers/new-driver-module/location/location.controller");
const locationRouter = express.Router();

locationRouter.patch("/driver-status", updateDriverStatus);

module.exports = locationRouter;

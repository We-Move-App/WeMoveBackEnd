const express = require("express");

const { isDriverAuthenticated } = require("../../../middlewares/authDriver");
const { CreateSecurePin, ChangeSecurePin, ResetSecurePin } = require("../../../controllers/driver-module/driver-secure-pin/driver-secure-pin.controllers");
const driverSecurePinRoutes = express.Router();

driverSecurePinRoutes.route("/create").post(isDriverAuthenticated, CreateSecurePin);
driverSecurePinRoutes.route("/change").post(isDriverAuthenticated, ChangeSecurePin);
driverSecurePinRoutes
  .route("/reset-pin")
  .post(isDriverAuthenticated, ResetSecurePin);


module.exports = driverSecurePinRoutes;

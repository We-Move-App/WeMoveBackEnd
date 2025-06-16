const express = require("express");
const { isBusOperatorAuthenticated } = require("../../../middlewares/authBusOperator");
const {
  CreateSecurePin,
  ChangeSecurePin,
  ResetSecurePin,
} = require("../../../controllers/bus-module/bus-operator-security-pin/bus-operator-security-pin.controllers");
const busOperatorSecurityPinsRotues = express.Router();

busOperatorSecurityPinsRotues
  .route("/create")
  .post(isBusOperatorAuthenticated, CreateSecurePin);
busOperatorSecurityPinsRotues
  .route("/change")
  .post(isBusOperatorAuthenticated, ChangeSecurePin);
busOperatorSecurityPinsRotues
  .route("/reset-pin")
  .post(isBusOperatorAuthenticated, ResetSecurePin);

module.exports = busOperatorSecurityPinsRotues;

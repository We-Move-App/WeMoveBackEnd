const express = require("express");
const {
  addDriverBankDetails,
  getDriverBankDetails,
} = require("../../../controllers/new-driver-module/bank-details/bank-details.controller");
const {
  isNDriverAuthenticated,
} = require("../../../middlewares/authNewDriver");
const driverBankRoute = express.Router();

driverBankRoute.post(
  "/bank-details",
  isNDriverAuthenticated,
  addDriverBankDetails
);
driverBankRoute.get(
  "/bank-details",
  isNDriverAuthenticated,
  getDriverBankDetails
);

module.exports = driverBankRoute;

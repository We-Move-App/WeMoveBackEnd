const express = require("express");
const {
  addDriverBankDetails, getDriverBankDetails
} = require("../../../controllers/new-driver-module/bank-details/bank-details.controller");
const driverBankRoute = express.Router();

driverBankRoute.post("/bank-details", addDriverBankDetails);
driverBankRoute.get("/bank-details", getDriverBankDetails);

module.exports = driverBankRoute;

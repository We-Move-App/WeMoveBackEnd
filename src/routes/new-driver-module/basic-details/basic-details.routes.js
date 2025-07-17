const express = require("express");
const {
  addDriverBasicDetails,
  getDriverBasicDetails,
} = require("../../../controllers/new-driver-module/basic-details/basic-details.controller");
const driverBasicDetailsRouter = express.Router();

driverBasicDetailsRouter.post("/basic-details", addDriverBasicDetails);
driverBasicDetailsRouter.get("/basic-details", getDriverBasicDetails);

module.exports = driverBasicDetailsRouter;

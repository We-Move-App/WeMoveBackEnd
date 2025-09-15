const express = require("express");
const {
  addDriverBasicDetails,
  getDriverBasicDetails,
  getDriverProfileDetails,
  addPin,
  verifyPin,
  updatePin,
  deleteDriverProfile,
} = require("../../../controllers/new-driver-module/basic-details/basic-details.controller");
const driverBasicDetailsRouter = express.Router();

driverBasicDetailsRouter.post("/basic-details", addDriverBasicDetails);
driverBasicDetailsRouter.post("/set-pin", addPin);
driverBasicDetailsRouter.post("/verify-pin", verifyPin);
driverBasicDetailsRouter.get("/basic-details", getDriverBasicDetails);
driverBasicDetailsRouter.get("/profile", getDriverProfileDetails);
driverBasicDetailsRouter.put("/update-pin", updatePin);
driverBasicDetailsRouter.delete("/delete-profile", deleteDriverProfile);

module.exports = driverBasicDetailsRouter;

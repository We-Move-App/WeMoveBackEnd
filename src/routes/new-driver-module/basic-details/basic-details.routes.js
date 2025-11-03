const express = require("express");
const {
  addDriverBasicDetails,
  getDriverBasicDetails,
  getDriverProfileDetails,
  addPin,
  verifyPin,
  updatePin,
  resetSecurePin,
  deleteDriverProfile,
  updateDriverPhoneNumber,
  updateDriverEmail,
} = require("../../../controllers/new-driver-module/basic-details/basic-details.controller");
const {
  isNDriverAuthenticated,
} = require("../../../middlewares/authNewDriver");
const driverBasicDetailsRouter = express.Router();

driverBasicDetailsRouter.post(
  "/basic-details",
  isNDriverAuthenticated,
  addDriverBasicDetails
);
driverBasicDetailsRouter.post("/set-pin", isNDriverAuthenticated, addPin);
driverBasicDetailsRouter.post("/verify-pin", isNDriverAuthenticated, verifyPin);
driverBasicDetailsRouter.post(
  "/reset-pin",
  isNDriverAuthenticated,
  resetSecurePin
);
driverBasicDetailsRouter.get(
  "/basic-details",
  isNDriverAuthenticated,
  getDriverBasicDetails
);
driverBasicDetailsRouter.get(
  "/profile",
  isNDriverAuthenticated,
  getDriverProfileDetails
);
driverBasicDetailsRouter.put("/update-pin", isNDriverAuthenticated, updatePin);
driverBasicDetailsRouter.delete(
  "/delete-profile",
  isNDriverAuthenticated,
  deleteDriverProfile
);
driverBasicDetailsRouter.put(
  "/update-phone",
  isNDriverAuthenticated,
  updateDriverPhoneNumber
);
driverBasicDetailsRouter.put(
  "/update-email",
  isNDriverAuthenticated,
  updateDriverEmail
);

module.exports = driverBasicDetailsRouter;

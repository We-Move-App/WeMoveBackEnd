const DriverModel = require("../models/driver-module/drivers/drivers.model");

const catchAsyncError = require("../utils/response/catchAsyncError");

const { verifyTokenResultDriver } = require("../utils/services/jwt.services");

const isDriverAuthenticated = catchAsyncError(async (req, res, next) => {
  await verifyTokenResultDriver(req, next);
});

module.exports = { isDriverAuthenticated };

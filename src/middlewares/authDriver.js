const DriverModel = require("../models/driver-module/drivers/drivers.model");

const catchAsyncError = require("../utils/response/catchAsyncError");

const { verifyTokenResult } = require("../utils/services/jwt.services");

const isDriverAuthenticated = catchAsyncError(async (req, res, next) => {
  await verifyTokenResult(req, next);
});
  
module.exports = { isDriverAuthenticated };

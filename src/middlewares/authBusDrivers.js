const BusDriverModel = require("../models/bus-module/bus-drivers/bus-drivers.model");
const { authVerifyTokenResult } = require("../utils/jwtToken/authVerifyTokenResult");
const catchAsyncError = require("../utils/response/catchAsyncError");
const ApiError = require("../utils/response/ApiError");

const isBusDriverAuthenticated = catchAsyncError(async (req, res, next) => {
  const { userId, role ,tokenData } = authVerifyTokenResult(req);

  if (role !== "busDriver") {
    throw new ApiError(403, "Unauthorized role access");
  }

  const driver = await BusDriverModel.findById(userId);
  if (!driver) {
    throw new ApiError(401, "Bus driver not found");
  }

  req.user_id = driver._id;
  req.role = role;
 req.tokenData = tokenData;
  req.busdriver = driver;
  next();
});

module.exports = { isBusDriverAuthenticated };

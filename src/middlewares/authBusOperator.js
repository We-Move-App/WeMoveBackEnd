const BusOperatorModel = require("../models/bus-module/bus-operator/bus-operator.model");

const catchAsyncError = require("../utils/response/catchAsyncError");
const { verifyTokenResult } = require("../utils/services/jwt.services");

const isBusOperatorAuthenticated = catchAsyncError(async (req, res, next) => {
  await verifyTokenResult(req, BusOperatorModel, next);
});

module.exports = { isBusOperatorAuthenticated };

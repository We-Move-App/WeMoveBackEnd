const HotelManagerModel = require("../models/hotel-module/hotel-manager/hotel-manager.model");
const catchAsyncError = require("../utils/response/catchAsyncError");
const { verifyTokenResult } = require("../utils/services/jwt.services");

const isHotelManagerAuthenticated = catchAsyncError(async (req, res, next) => {
  await verifyTokenResult(req, HotelManagerModel, next);
});

module.exports = { isHotelManagerAuthenticated };

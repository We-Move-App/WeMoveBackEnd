const catchAsyncError = require("../utils/response/catchAsyncError");

const { verifyTokenResultDriver } = require("../utils/services/jwt.services");

const isNDriverAuthenticated = catchAsyncError(async (req, res, next) => {
  await verifyTokenResultDriver(req);
  return next();
});

module.exports = { isNDriverAuthenticated };

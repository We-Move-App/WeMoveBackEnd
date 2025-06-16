const UserModel = require("../models/user-module/users/user.model");
const catchAsyncError = require("../utils/response/catchAsyncError");
const jwt = require("jsonwebtoken");
const { verifyTokenResult } = require("../utils/services/jwt.services");

const isUserAuthenticated = catchAsyncError(async (req, res, next) => {
  await verifyTokenResult(req, UserModel, next);
});
module.exports = { isUserAuthenticated };

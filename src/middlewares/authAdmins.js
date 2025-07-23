const { access_token_secret } = require("../config/config");
const { AdminModel } = require("../models/admin-module/admin/admin.model");
const BusOperatorModel = require("../models/bus-module/bus-operator/bus-operator.model");
const BlackListTokenModel = require("../models/global-module/blacklist-tokens/blacklist-token.model");
const statusCode = require("../utils/constants/statusCode");
const logger = require("../utils/logger/logger");
const ApiError = require("../utils/response/ApiError");
const catchAsyncError = require("../utils/response/catchAsyncError");
const jwt = require("jsonwebtoken");

const message = {
  rejected: `Your account has been rejected. Please contact the Support for more details`,
  blocked: `Your account has been blocked. Please contact the Support for more details`,
};

const isAdminAuthenticated = catchAsyncError(async (req, res, next) => {
  logger.info("Hitting isAuthenticated middleware");

  const token =
    req?.cookies?.accessToken || req?.headers["authorization"]?.split(" ")[1];

  if (!token) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please login to access this resource"
    );
  }

  const blackListedToken = await BlackListTokenModel.findOne({
    accessToken: token,
  });
  if (blackListedToken) {
    logger.info("Blacklisted token found, returning unauthorized");
    throw new ApiError(statusCode.UNAUTHORIZED, "Please login to continue");
  }

  let decodedToken;
  try {
    decodedToken = jwt.verify(token, access_token_secret);
  } catch (error) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid access token");
  }

  const user = await AdminModel.findOne({
    _id: decodedToken?._id,
  }).select("_id email role verificationStatus authorities parentUserId") ||
  (await SuperAdminModel.findOne({ _id: decodedToken?._id }));

  if (!user) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Admin not found");
  }

  if (["approved"].includes(user?.verificationStatus)) {
    req.user = user;
    return next();
  }

  throw new ApiError(
    statusCode.FORBIDDEN,
    message[user?.verificationStatus] ||
      "Your account is awaiting admin approval."
  );
});

module.exports = { isAdminAuthenticated };

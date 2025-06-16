const { access_token_secret } = require("../../config/config");
const BlackListTokenModel = require("../../models/global-module/blacklist-tokens/blacklist-token.model");
const statusCode = require("../constants/statusCode");
const logger = require("../logger/logger");
const ApiError = require("../response/ApiError");
const jwt = require("jsonwebtoken");

const message = {
  processing: `You are in processing. Please wait for the Admin's Approval `,
  rejected: `Your account has been rejected. Please contact the Support for more details`,
  blocked: `Your account has been blocked. Please contact the Support for more details`,
};

const verifyTokenResult = async (req, model, next) => {
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
  const user = await model
    .findOne({ _id: decodedToken?._id })
    .select("_id email role verificationStatus authorities parentUserId");
  if (!user) {
    throw new ApiError(statusCode.UNAUTHORIZED, "User not found");
  }

  if (["submitted", "approved"].includes(user?.verificationStatus)) {
    req.user = user;
    return next();
  }

  throw new ApiError(
    statusCode.FORBIDDEN,
    message[user?.verificationStatus] ||
      "Your account is awaiting admin approval."
  );
};

module.exports = {
  verifyTokenResult,
};

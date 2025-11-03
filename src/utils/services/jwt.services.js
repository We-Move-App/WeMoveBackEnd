const { access_token_secret } = require("../../config/config");
const BlackListTokenModel = require("../../models/global-module/blacklist-tokens/blacklist-token.model");
const DeviceTokensModel = require("../../models/global-module/device-tokens/device-tokens.model");
const { AccessTokenModel } = require("../../models/token/token.model");
const statusCode = require("../constants/statusCode");
const { decodeAccessToken } = require("../jwtToken/customTokenService");
const logger = require("../logger/logger");
const ApiError = require("../response/ApiError");
const jwt = require("jsonwebtoken");
const DriverBasicDetails = require("../../models/new-driver-module/basic-details/basic-details.model");

const message = {
  processing: `You are in processing. Please wait for the Admin's Approval `,
  rejected: `Your account has been rejected. Please contact the Support for more details`,
  blocked: `Your account has been blocked. Please contact the Support for more details`,
};

const verifyTokenResult = async (req, model, next) => {
  logger.info("Hitting isAuthenticated middleware");

  // Safely read token from Cookie or Authorization: Bearer <token>
  let token = null;
  if (req?.cookies?.accessToken) {
    token = req.cookies.accessToken;
  } else if (req?.headers?.authorization) {
    const parts = req.headers.authorization.split(" ");
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      token = parts[1];
    }
  }

  if (!token) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please login to access this resource"
    );
  }

  // 1) Check blacklist first
  const blackListedToken = await BlackListTokenModel.findOne({
    accessToken: token,
  });
  if (blackListedToken) {
    logger.info("Blacklisted token found, returning unauthorized");
    throw new ApiError(statusCode.UNAUTHORIZED, "Please login to continue");
  }

  // 2) Verify JWT signature + expiry
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, access_token_secret);
  } catch (error) {
    // JWT invalid / expired
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid access token");
  }

  // 3) Load user by _id from token
  const user = await model
    .findById({ _id: decodedToken?._id })
    .select("_id email role verificationStatus authorities parentUserId");
  if (!user) {
    throw new ApiError(statusCode.UNAUTHORIZED, "User not found");
  }

  // const deviceRecord = await AccessTokenModel.findOne({
  //   user: user._id,
  //   token: token,
  // }).lean();

  // if (!deviceRecord) {
  //   throw new ApiError(
  //     statusCode.UNAUTHORIZED,
  //     "Token expired or you have logged in with another device"
  //   );
  // }

  // 5) Verification status check (keep your original logic)
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

const verifyTokenResultUser = async (req, model, next) => {
  logger.info("Hitting isAuthenticated middleware");

  // Safely read token from Cookie or Authorization: Bearer <token>
  let token = null;
  if (req?.cookies?.accessToken) {
    token = req.cookies.accessToken;
  } else if (req?.headers?.authorization) {
    const parts = req.headers.authorization.split(" ");
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      token = parts[1];
    }
  }

  if (!token) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please login to access this resource"
    );
  }

  // 1) Check blacklist first
  const blackListedToken = await BlackListTokenModel.findOne({
    accessToken: token,
  });
  if (blackListedToken) {
    logger.info("Blacklisted token found, returning unauthorized");
    throw new ApiError(statusCode.UNAUTHORIZED, "Please login to continue");
  }

  // 2) Verify JWT signature + expiry
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, access_token_secret);
  } catch (error) {
    // JWT invalid / expired
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid access token");
  }

  // 3) Load user by _id from token
  const user = await model
    .findById({ _id: decodedToken?._id })
    .select("_id email role verificationStatus authorities parentUserId");
  if (!user) {
    throw new ApiError(statusCode.UNAUTHORIZED, "User not found");
  }

  const deviceRecord = await AccessTokenModel.findOne({
    user: user._id,
    token: token,
  }).lean();

  if (!deviceRecord) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Token expired or you have logged in with another device"
    );
  }

  // 5) Verification status check (keep your original logic)
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

const verifyTokenResultDriver = async (req) => {
  logger.info("Hitting isAuthenticated driver middleware");

  const auth = req.get?.("authorization") || req.headers?.authorization || "";
  const [scheme, rawToken] = auth.split(" ");

  if (!rawToken || !/^Bearer$/i.test(scheme)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Authorization header missing or not using Bearer scheme"
    );
  }

  const token = rawToken.trim();

  let decodedToken;
  try {
    decodedToken = decodeAccessToken(token);
  } catch {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid access token");
  }

  const driver = await DriverBasicDetails.findOne({
    driverId: decodedToken.driverId,
  });
  if (!driver) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Driver not found");
  }

  const deviceRecord = await AccessTokenModel.findOne({
    user: driver.driverId,
    token: token,
  }).lean();

  if (!deviceRecord) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Token expired or you have logged in with another device"
    );
  }

  req.user = driver;
  req.token = token;

  return;
};

module.exports = {
  verifyTokenResult,
  verifyTokenResultUser,
  verifyTokenResultDriver,
};

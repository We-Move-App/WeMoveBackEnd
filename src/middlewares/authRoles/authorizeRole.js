const statusCode = require("../../utils/constants/statusCode");
const logger = require("../../utils/logger/logger");
const ApiError = require("../../utils/response/ApiError");
const { isUserAuthenticated } = require("../authUser");
const { isNDriverAuthenticated } = require("../authNewDriver");
const {
  decodeAccessToken,
} = require("../../utils/jwtToken/customTokenService");

const authorizeRole = (roles) => (req, res, next) => {
  roles = Array.isArray(roles) ? roles : [roles];
  console.log(roles);

  logger.info(`Hitting authorizeRole middleware - Allowed Roles: ${roles}`);
  if (!req.user) {
    logger.warn("Unauthorized access attempt - No user found");
    throw new ApiError(statusCode.UNAUTHORIZED, "Authentication required");
  }
  console.log("req.user.role :", req.user.role);

  const isAuthorized = roles.map((r) => r.includes(req.user.role));
  if (!isAuthorized) {
    logger.warn(`Access denied - User Role: ${req.user.role}`);
    throw new ApiError(
      statusCode.FORBIDDEN,
      "You are not authorized to perform this action"
    );
  }

  logger.info(`Access granted - User Role: ${req.user.role}`);
  return next();
};

const conditionalAuth = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) token = authHeader.split(" ")[1];
    if (!token && req?.cookies?.accessToken) token = req.cookies.accessToken;

    if (!token) {
      return next(
        new ApiError(
          statusCode.UNAUTHORIZED,
          "Access token is missing or invalid"
        )
      );
    }

    // IMPORTANT: await this if it returns a Promise
    const decoded = decodeAccessToken(token);
    if (!decoded) {
      return next(
        new ApiError(statusCode.UNAUTHORIZED, "Invalid access token")
      );
    }

    req.decodedToken = decoded;
    // normalize role to avoid "Driver" vs "driver" mismatches
    const role = (decoded.role || "").toLowerCase();
    req.authRole = decoded.role || null;

    if (role === "user") {
      return isUserAuthenticated(req, res, next);
    } else if (role === "driver") {
      return isNDriverAuthenticated(req, res, next);
    }

    return next();
  } catch (err) {
    // Ensure every failure hits Express error handler, not process.on('unhandledRejection')
    return next(
      new ApiError(
        statusCode.UNAUTHORIZED,
        err?.message || "Invalid access token"
      )
    );
  }
};

module.exports = { authorizeRole, conditionalAuth };

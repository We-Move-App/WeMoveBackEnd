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
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) token = authHeader.split(" ")[1];
  if (!token && req?.cookies?.accessToken) token = req.cookies.accessToken;

  if (!token) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  let decoded;
  try {
    decoded = decodeAccessToken(token);
  } catch {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid access token");
  }

  req.decodedToken = decoded;
  req.authRole = decoded?.role || null;

  if (req.authRole === "user") {
    return isUserAuthenticated(req, res, next);
  } else if (req.authRole === "Driver") {
    return isNDriverAuthenticated(req, res, next);
  }

  return next();
};

module.exports = { authorizeRole, conditionalAuth };

const statusCode = require("../../utils/constants/statusCode");
const logger = require("../../utils/logger/logger");
const ApiError = require("../../utils/response/ApiError");
const {
  busOperatorAuthorities,
} = require("../../utils/constants/constants");

const authorizeRole = (roles) => (req, res, next) => {
  
  roles = Array.isArray(roles) ? roles : [roles];
  console.log(roles)

  logger.info(`Hitting authorizeRole middleware - Allowed Roles: ${roles}`);
  if (!req.user) {
    logger.warn("Unauthorized access attempt - No user found");
    throw new ApiError(statusCode.UNAUTHORIZED, "Authentication required");
  }
  const isAuthorized = roles.includes(req.user.role);
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

module.exports = { authorizeRole };

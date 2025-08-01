const ApiError = require("../response/ApiError");
const statusCode = require("../constants/statusCode");
const { decodeAccessToken } = require("./customTokenService");

const authVerifyTokenResult = (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Authorization token missing");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = decodeAccessToken(token); 

    const userId =
      decoded.driverId || decoded.userId || decoded.adminId || decoded.busdriverId;

    if (!userId || !decoded.role) {
      throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token payload");
    }

    return { userId, role: decoded.role, tokenData: decoded };
  } catch (error) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid or expired token");
  }
};

module.exports = { authVerifyTokenResult };

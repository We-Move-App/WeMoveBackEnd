const catchAsyncError = require("../utils/response/catchAsyncError");
const jwt = require("jsonwebtoken");

const authenticate = catchAsyncError(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
  } catch (error) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid or expired token");
  }

  // attach decoded payload to request
  req.user = decoded;

  next();
});

module.exports = { authenticate };

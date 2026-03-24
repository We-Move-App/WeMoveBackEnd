const {
  access_token_secret,
  refresh_token_secret,
  refresh_token_expiration_time,
  access_token_expiration_time,
  node_env,
} = require("../../config/config");

const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_SECRET = access_token_secret;
const REFRESH_TOKEN_SECRET = refresh_token_secret;

// Token expiration times
const ACCESS_TOKEN_EXPIRATION = access_token_expiration_time;
const REFRESH_TOKEN_EXPIRATION = refresh_token_expiration_time;

const generateTokens = async (user, userType) => {
  const payload = {
    _id: user?._id,
    userId: user.userId,
    email: user?.email,
    role: user?.role,
    authorities: user?.authorities,
    parentUserId: user?.parentUserId,
    isVerfilled: user?.isVerfilled,
    userType: userType,
    phoneNumber: user?.phoneNumber,
    verificationStatus: user?.verificationStatus,
    permissions: user.permissions || {},
    branch: user?.branch?._id || user?.branch || null,
  };

  const refreshTokenPayload = {
    _id: user?._id,
  };

  // Generate access token
  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRATION,
  });

  // Generate refresh token
  const refreshToken = jwt.sign(refreshTokenPayload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRATION,
  });

  // try {
  //   if (user?._id) {
  //     await redis.set(user._id.toString(), JSON.stringify(user));
  //     logger.info("User save in redis cache successfully");
  //   } else {
  //     console.error("Error saving user in redis cache");
  //     throw new ApiError(
  //       statusCode.BAD_REQUEST,
  //       "Error in saving user in redis cache"
  //     );
  //   }
  // } catch (error) {
  //   console.error("Error generating tokens:", error);
  //   throw new ApiError(
  //     statusCode.BAD_REQUEST,
  //     "Error in saving user in redis cache"
  //   );
  // }

  return { accessToken, refreshToken };
};

const setTokenCookies = (res, accessToken, refreshToken) => {
  const cookieOptions = {
    httpOnly: true,
    secure: node_env === "production",
    sameSite: "strict",
  };

  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    // maxAge: 30 * 60 * 1000, // 30 minutes
    maxAge: 1 * 24 * 60 * 60 * 1000, // 30 minute
  });

  // Set refresh token as a cookie (long-lived)
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: 1 * 24 * 60 * 60 * 1000, // 1 days
  });
};

const generateUserTokens = async (user, userType) => {
  const payload = {
    _id: user?._id,
    userId: user.userId,
    email: user?.email,
    role: user?.role,
    authorities: user?.authorities,
    parentUserId: user?.parentUserId,
    isVerfilled: user?.isVerfilled,
    userType: userType,
    phoneNumber: user?.phoneNumber,
    verificationStatus: user?.verificationStatus,
    permissions: user.permissions || {},
    branch: user?.branch?._id || user?.branch || null,
  };

  const refreshTokenPayload = {
    _id: user?._id,
  };

  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET);

  const refreshToken = jwt.sign(refreshTokenPayload, REFRESH_TOKEN_SECRET);

  return { accessToken, refreshToken };
};

module.exports = { generateUserTokens, generateTokens, setTokenCookies };

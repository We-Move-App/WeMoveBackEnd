const jwt = require("jsonwebtoken");
const RefreshToken = require("../../models/refresh-token/refresh-token.model");
const DriverBasicDetails = require("../../models/new-driver-module/basic-details/basic-details.model");

const generateTokens = (data) => {
  const entity = data.toObject ? data.toObject() : { ...data };

  const { password, createdAt, updatedAt, __v, ...accessPayload } = entity;

  const refreshPayload = {
    id: entity.driverId || entity.userId || entity.adminId,
    role: entity.role,
  };

  const accessToken = jwt.sign(accessPayload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "2h",
  });

  const refreshToken = jwt.sign(
    refreshPayload,
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

const decodeAccessToken = (token) => {
  if (!token) {
    throw new Error("Token is required");
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    return decoded;
  } catch (err) {
    throw new Error("Invalid or expired access token");
  }
};

const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new Error("Refresh token is required");
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    const { id, role } = decoded;

    if (!id || !role) {
      throw new Error("Invalid refresh token payload");
    }

    let user;

    switch (role) {
      case "Driver":
        user = await DriverBasicDetails.findOne({ driverId: id });
        break;
      //   case "User":
      //     user = await User.findOne({ userId:id });
      //     break;
      //   case "Admin":
      //     user = await Admin.findOne({ adminId: id });
      //     break;
      default:
        throw new Error("Invalid role in refresh token");
    }

    if (!user) {
      throw new Error("User not found");
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    return { accessToken, refreshToken: newRefreshToken };
  } catch (err) {
    throw new Error("Invalid or expired refresh token");
  }
};

const saveRefreshToken = async ({
  userId,
  userType,
  token,
  expiresInMs,
  ip,
  userAgent,
}) => {
  const expiresAt = new Date(Date.now() + expiresInMs);

  const existingToken = await RefreshToken.findOne({ userId, userType });

  if (existingToken) {
    existingToken.token = token;
    existingToken.expiresAt = expiresAt;
    existingToken.ip = ip;
    existingToken.userAgent = userAgent;
    existingToken.isRevoked = false;

    return await existingToken.save();
  } else {
    const refreshTokenDoc = new RefreshToken({
      userId,
      userType,
      token,
      ip,
      userAgent,
      expiresAt,
    });

    return await refreshTokenDoc.save();
  }
};

module.exports = {
  generateTokens,
  decodeAccessToken,
  refreshAccessToken,
  saveRefreshToken,
};

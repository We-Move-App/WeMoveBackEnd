const DriverBasicDetails = require("../../../models/new-driver-module/basic-details/basic-details.model");
const { EntityCodeEnum } = require("../../../utils/constants/ENUM");
const statusCode = require("../../../utils/constants/statusCode");
const generateCustomId = require("../../../utils/customId/generateCustomId");
const {
  saveRefreshToken,
  generateTokens,
  decodeAccessToken,
  refreshAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const {
  sendOtpToPhone,
  verifyPhoneOtp,
  sendOtpToEmail,
  verifyEmailOtp,
} = require("../../../utils/otpService/otpService");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");

const sendOtpToPhoneHandler = catchAsyncError(async (req, res) => {
  const { phoneNo } = req.body;

  if (!phoneNo) {
    throw new ApiError(statusCode.BAD_REQUEST, "Phone number is required");
  }

  let driver = await DriverBasicDetails.findOne({ phoneNo });

  await sendOtpToPhone(phoneNo);

  if (!driver) {
    const driverId = await generateCustomId(EntityCodeEnum.DRIVER, "D");

    driver = new DriverBasicDetails({
      driverId,
      phoneNo,
    });

    await driver.save();
  }

  return res
    .status(statusCode.CREATED)
    .json(new ApiResponse(statusCode.CREATED, null, "Otp Sent successfully"));
});

const verifyPhoneOtpHandler = catchAsyncError(async (req, res) => {
  const { phoneNo, otp } = req.body;

  if (!phoneNo || !otp) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Phone number and OTP are required"
    );
  }

  await verifyPhoneOtp(phoneNo, otp);

  const driver = await DriverBasicDetails.findOne({ phoneNo });

  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  const { accessToken, refreshToken } = generateTokens(driver);

  await saveRefreshToken({
    userId: driver.driverId,
    userType: EntityCodeEnum.DRIVER,
    token: refreshToken,
    expiresInMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  return res.status(statusCode.CREATED).json(
    new ApiResponse(
      statusCode.CREATED,
      {
        accessToken,
        refreshToken,
        driverId: driver.driverId,
        phoneNo: driver.phoneNo,
        email: driver.email,
        status: driver.status || null,
      },
      "Phone verified successfully"
    )
  );
});

const sendOtpToEmailHandler = catchAsyncError(async (req, res) => {
  const { email } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);

  const driverId = decoded.driverId;
  if (!driverId || !email) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Email and valid token are required"
    );
  }

  const driver = await DriverBasicDetails.findOne({ driverId });

  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  await sendOtpToEmail(email);

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        null,
        "OTP sent to email successfully"
      )
    );
});

const verifyEmailOtpHandler = catchAsyncError(async (req, res) => {
  const { email, otp } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);

  const driverId = decoded.driverId;
  if (!driverId || !email || !otp) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Driver ID, email and OTP are required"
    );
  }

  await verifyEmailOtp(email, otp);

  const driver = await DriverBasicDetails.findOneAndUpdate(
    { driverId },
    { email },
    { new: true }
  );

  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  const { accessToken: newAccessToken, refreshToken } = generateTokens(driver);

  await saveRefreshToken({
    userId: driver.driverId,
    userType: EntityCodeEnum.DRIVER,
    token: refreshToken,
    expiresInMs: 7 * 24 * 60 * 60 * 1000,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  return res.status(statusCode.CREATED).json(
    new ApiResponse(
      statusCode.CREATED,
      {
        accessToken: newAccessToken,
        refreshToken,
        driverId: driver.driverId,
        phoneNo: driver.phoneNo,
        email: driver.email,
        status: driver.status || null,
      },
      "Email verified successfully"
    )
  );
});

const refreshAccessTokenHandler = catchAsyncError(async (req, res) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Refresh token is missing or malformed"
    );
  }

  const token = authHeader.split(" ")[1];

  const { accessToken, refreshToken: newRefreshToken } =
    await refreshAccessToken(token);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { accessToken, refreshToken: newRefreshToken },
        "Access token refreshed successfully"
      )
    );
});

module.exports = {
  sendOtpToPhoneHandler,
  verifyPhoneOtpHandler,
  sendOtpToEmailHandler,
  verifyEmailOtpHandler,
  refreshAccessTokenHandler,
};

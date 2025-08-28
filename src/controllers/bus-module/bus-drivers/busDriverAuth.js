const BusDriverModel = require("../../../models/bus-module/bus-drivers/bus-drivers.model");
const BusOperatorModel = require("../../../models/bus-module/bus-operator/bus-operator.model");
const {
  busOperatorAuthoritiesFields,
} = require("../../../utils/constants/constants");
const statusCode = require("../../../utils/constants/statusCode");
const {
  validateRequestBody,
  checkBusOperatorAuthority,
} = require("../../../utils/reqFunctions/reqFunction");

const catchAsyncError = require("../../../utils/response/catchAsyncError");
const { EntityCodeEnum } = require("../../../utils/constants/ENUM");

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

const sendOtpToBusDriver = catchAsyncError(async (req, res) => {
  const { phoneNo } = req.body;

  if (!phoneNo) {
    throw new ApiError(statusCode.BAD_REQUEST, "Phone number is required");
  }

  const driver = await BusDriverModel.findOne({ phoneNumber: phoneNo });

  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus driver not found");
  }

  await sendOtpToPhone(phoneNo);

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, null, "OTP sent successfully"));
});

const verifyOtpBusDriverLogin = catchAsyncError(async (req, res) => {
  const { phoneNo, otp } = req.body;

  if (!phoneNo || !otp) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Phone number and OTP are required"
    );
  }

  await verifyPhoneOtp(phoneNo, otp);

  const driver = await BusDriverModel.findOne({ phoneNumber: phoneNo });

  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus driver not found");
  }

  const { accessToken, refreshToken } = generateTokens({
    driverId: driver._id,
    role: EntityCodeEnum.BUSDRIVER,
  });

  await saveRefreshToken({
    userId: driver._id,
    userType: EntityCodeEnum.BUSDRIVER,
    token: refreshToken,
    expiresInMs: 7 * 24 * 60 * 60 * 1000,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        accessToken,
        refreshToken,
        busdriver: {
          id: driver._id,
          fullName: driver.fullName,
          phoneNo: driver.phoneNumber,
          busOperator: driver.busOperator,
          assignedBus: driver.assignedBus,
          status: driver.status,
          isActive: driver.isActive,
        },
      },
      "Login successful"
    )
  );
});

const getBusDriverProfile = catchAsyncError(async (req, res) => {
  const driverId = req.user_id; // Step 1: Get driver ID from request

  // Step 3: Ensure only drivers can access this route
  if (!driverId) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Only drivers are authorized to access this route"
    );
  }

  const driverExists = await BusDriverModel.exists({ _id: driverId });
  if (!driverExists) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus driver not found");
  }
  const driver = await BusDriverModel.findById(driverId)
    .select(
      "fullName phoneNumber assignedBus status isActive licenseExpiry driverLicenseFront avatar createdAt updatedAt"
    )

    .populate("assignedBus");

  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus driver not found");
  }

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        id: driver._id,
        fullName: driver.fullName,
        phoneNumber: driver.phoneNumber,
        busOperator: driver.busOperator,
        assignedBus: driver.assignedBus,
        status: driver.status,
        licenseExpiry: driver.licenseExpiry,
        isActive: driver.isActive,
        driverLicenseFront: driver.driverLicenseFront,
        avatar: driver.avatar,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt,
      },
      "Bus driver profile fetched successfully"
    )
  );
});

module.exports = {
  sendOtpToBusDriver,
  verifyOtpBusDriverLogin,
  getBusDriverProfile,
};

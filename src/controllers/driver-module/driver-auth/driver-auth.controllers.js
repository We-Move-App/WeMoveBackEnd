const catchAsyncError = require("../../../utils/response/catchAsyncError");
const statusCode = require("../../../utils/constants/statusCode");
const ApiResponse = require("../../../utils/response/ApiResponse");
const DriverModel = require("../../../models/driver-module/drivers/drivers.model");
const {
  removeDeviceToken,
  saveDeviceToken,
} = require("../../../utils/services/deviceToken.services");
const DriverDeviceTokenModel = require("../../../models/driver-module/driver-device-tokens/driver-device-tokens.model");
const {
  validateRequestBody,
} = require("../../../utils/reqFunctions/reqFunction");
const { TypeOfUser } = require("../../../utils/constants/constants");
const {
  registerUserWithEmailOrPhoneAndOtp,
  registerUserWithEmailAndPhoneNumber,
  loginUserWithEmailAndPhoneNumber,
  logoutUserFunc,
  refreshTokenFunc,
  resendOtpFunc,
  verifyOtpFunc,
  checkUserVerificationStatus,
  addEmailOrPhoneNumberFunc,
  verifyOtpWithoutTokenFunc,
  resendOtpWithoutTokenFunc,
  verifyEmailExistFunc,
} = require("../../../utils/services/functions.services");
const logger = require("../../../utils/logger/logger");

// =====================|| REGISTER DRIVER BY PHONE NUMBER ||==========================
const registerUserWithOtp = catchAsyncError(async (req, res, next) => {
  logger.info("Driver is registering with OTP");

  const result = await registerUserWithEmailOrPhoneAndOtp({
    req,
    res,
    reqModel: DriverModel,
    typeOfUser: TypeOfUser.DRIVER,
  });

  const { accessToken, refreshToken, reqData } = result;
  const data = {
    accessToken,
    refreshToken,
    driver: reqData,
  };

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        data,
        `OTP is sent successfully to this ${req.body.emailOrPhone}`
      )
    );
});

// =====================|| REGISTER DRIVER ||==========================
const registerUser = catchAsyncError(async (req, res, next) => {
  const result = await registerUserWithEmailAndPhoneNumber({
    req,
    res,
    reqModel: DriverModel,
    typeOfUser: TypeOfUser.DRIVER,
  });

  return res.status(statusCode.OK).json(result);
});

// =====================|| LOGIN USER ||=====================================
const loginUser = catchAsyncError(async (req, res, next) => {
  const result = await loginUserWithEmailAndPhoneNumber({
    req,
    res,
    reqModel: DriverModel,
    typeOfUser: TypeOfUser.DRIVER,
  });

  return res.status(statusCode.OK).json(result);
});

// =====================|| LOGOUT USER ||====================================
const logoutUser = catchAsyncError(async (req, res, next) => {
  const result = await logoutUserFunc({ req, res });

  return res.status(statusCode.OK).json(result);
});

// =====================|| REFRESH TOKEN ||==================================
const refreshToken = catchAsyncError(async (req, res, next) => {
  const result = await refreshTokenFunc({
    req,
    res,
    reqModel: DriverModel,
    typeOfUser: TypeOfUser.DRIVER,
  });

  return res.status(statusCode.OK).json(result);
});

// =====================|| RESEND OTP ||=====================================
const resendOtp = catchAsyncError(async (req, res, next) => {
  const result = await resendOtpFunc({
    req,
    res,
    reqModel: DriverModel,
  });
  // Send response indicating where the OTP was sent
  return res.status(statusCode.OK).json(result);
});

// =====================|| VERIFY OTP ||=====================================
const verifyOTP = catchAsyncError(async (req, res, next) => {
  const result = await verifyOtpFunc({
    req,
    res,
    reqModel: DriverModel,
  });
  return res.status(statusCode.OK).json(result);
});

// =====================|| RESEND OTP WITHOUT AUTH ||=====================================
const resendOtpWithoutAuth = catchAsyncError(async (req, res, next) => {
  const result = await resendOtpWithoutTokenFunc({
    req,
    res,
    reqModel: DriverModel,
  });
  // Send response indicating where the OTP was sent
  return res.status(statusCode.OK).json(result);
});

// =====================|| VERIFY OTP WITHOUT AUTH ||=====================================
const verifyOTPWithoutAuth = catchAsyncError(async (req, res, next) => {
  const result = await verifyOtpWithoutTokenFunc({
    req,
    res,
    reqModel: DriverModel,
  });
  return res.status(statusCode.OK).json(result);
});

// =====================|| CHECK YOUR APPLICATION STATUS ||======================
const verifyStatus = catchAsyncError(async (req, res, next) => {
  const result = await checkUserVerificationStatus({
    req,
    res,
    reqModel: DriverModel,
  });
  return res.status(statusCode.OK).json(result);
});

// =====================|| ADD EMAIL  ||==================================
const addEmailOrPhone = catchAsyncError(async (req, res, next) => {
  const result = await addEmailOrPhoneNumberFunc({
    req,
    res,
    reqModel: DriverModel,
  });
  return res.status(statusCode.OK).json(result);
});

const saveDeviceTokens = catchAsyncError(async (req, res, next) => {
  const { token, deviceType } = req.body;

  const reqField = ["token", "deviceType"];
  validateRequestBody(reqField, req.body);

  const model = DriverDeviceTokenModel;

  const response = await saveDeviceToken(
    req.user._id,
    token,
    deviceType,
    model
  );
  return res.status(statusCode.OK).json(response);
});
const removeDeviceTokens = catchAsyncError(async (req, res, next) => {
  const { token, deviceType } = req.body;

  const reqField = ["token", "deviceType"];
  validateRequestBody(reqField, req.body);

  const model = DriverDeviceTokenModel;

  const response = await removeDeviceToken(
    req.user._id,
    token,
    deviceType,
    model
  );
  return res.status(statusCode.OK).json(response);
});
const verifyEmailExist = catchAsyncError(async (req, res, next) => {
  const result = await verifyEmailExistFunc({
    req,
    res,
    reqModel: DriverModel,
  });

  return res.status(statusCode.OK).json(result);
});

module.exports = {
  registerUserWithOtp,
  loginUser,
  logoutUser,
  refreshToken,
  registerUser,
  resendOtp,
  verifyOTP,
  verifyStatus,
  addEmailOrPhone,
  saveDeviceTokens,
  removeDeviceTokens,
  verifyOTPWithoutAuth,
  resendOtpWithoutAuth,
  verifyEmailExist,
};

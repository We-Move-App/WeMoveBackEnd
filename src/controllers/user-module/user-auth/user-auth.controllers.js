const catchAsyncError = require("../../../utils/response/catchAsyncError");
const statusCode = require("../../../utils/constants/statusCode");
const logger = require("../../../utils/logger/logger");
const UserModel = require("../../../models/user-module/users/user.model");
const ApiResponse = require("../../../utils/response/ApiResponse");
const UserBankModel = require("../../../models/user-module/user-banks/user-banks.model");
const {
  saveDeviceToken,
  removeDeviceToken,
} = require("../../../utils/services/deviceToken.services");
const UserDeviceTokenModel = require("../../../models/user-module/user-device-tokens/user-device-tokens.model");
const {
  validateRequestBody,
} = require("../../../utils/reqFunctions/reqFunction");
const { TypeOfUser } = require("../../../utils/constants/constants");
const {
  registerUserWithEmailOrPhoneAndOtp,
  sendOtpOnlyWithoutUserCreation,
  registerUserWithEmailAndPhoneNumber,
  loginUserWithEmailAndPhoneNumber,
  logoutUserFunc,
  refreshTokenFunc,
  resendOtpFunc,
  checkUserVerificationStatus,
  addEmailOrPhoneNumberFunc,
  resendOtpWithoutTokenFunc,
  verifyOtpWithoutTokenFunc,
  verifyEmailExistFunc,
  verifyOtpFunc,
} = require("../../../utils/services/functions.services");

//=====================|| REGISTER USER ||============================
// const registerUserWithOtp = catchAsyncError(async (req, res, next) => {
//   logger.info("Driver is registering with OTP");

//   const result = await registerUserWithEmailOrPhoneAndOtp({
//     req,
//     res,
//     reqModel: UserModel,
//     typeOfUser: TypeOfUser.USER,
//   });

//   const { accessToken, refreshToken, reqData } = result;
//   const data = {
//     accessToken,
//     refreshToken,
//     user: reqData,
//   };

//   return res
//     .status(statusCode.OK)
//     .json(
//       new ApiResponse(
//         statusCode.OK,
//         data,
//         `OTP is sent successfully to this ${req.body.emailOrPhone}`
//       )
//     );
// });
// NewVersion of registerUserWithOtp
const registerUserWithOtp = catchAsyncError(async (req, res, next) => {
  logger.info("User is registering with OTP");

  const result = await registerUserWithEmailOrPhoneAndOtp({
    req,
    res,
    reqModel: UserModel,
    typeOfUser: TypeOfUser.USER,
  });

  const isSuccess = result;

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        null,
        `OTP is sent successfully to this ${req.body.emailOrPhone}`
      )
    );
});

const registerUser = catchAsyncError(async (req, res, next) => {
  const result = await registerUserWithEmailAndPhoneNumber({
    req,
    res,
    reqModel: UserModel,
    typeOfUser: TypeOfUser.USER,
  });

  return res.status(statusCode.OK).json(result);
});

// ======================|| LOGIN USER ||========================
const loginUser = catchAsyncError(async (req, res, next) => {
  const result = await loginUserWithEmailAndPhoneNumber({
    req,
    res,
    reqModel: UserModel,
    typeOfUser: TypeOfUser.USER,
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
    reqModel: UserModel,
    typeOfUser: TypeOfUser.USER,
  });

  return res.status(statusCode.OK).json(result);
});

// =====================|| RESEND OTP ||=====================================
const resendOtp = catchAsyncError(async (req, res, next) => {
  const result = await resendOtpFunc({
    req,
    res,
    reqModel: UserModel,
  });
  // Send response indicating where the OTP was sent
  return res.status(statusCode.OK).json(result);
});

// =====================|| VERIFY OTP ||=====================================
// const verifyOTP = catchAsyncError(async (req, res, next) => {
//   const result = await verifyOtpFunc({

//     req,
//     res,
//     reqModel: UserModel,
//   });
//   return res.status(statusCode.OK).json(result);
// });
// =====================|| RESEND OTP WITHOUT AUTH ||=====================================
const resendOtpWithoutAuth = catchAsyncError(async (req, res, next) => {
  const result = await resendOtpWithoutTokenFunc({
    req,
    res,
    reqModel: UserModel,
  });
  // Send response indicating where the OTP was sent
  return res.status(statusCode.OK).json(result);
});

// =====================|| VERIFY OTP WITHOUT AUTH ||=====================================
const verifyOTPWithoutAuth = catchAsyncError(async (req, res, next) => {
  const result = await verifyOtpWithoutTokenFunc({
    req,
    res,
    reqModel: UserModel,
  });
  return res.status(statusCode.OK).json(result);
});
// =====================|| CHECK YOUR APPLICATION STATUS ||======================
const verifyStatus = catchAsyncError(async (req, res, next) => {
  const result = await checkUserVerificationStatus({
    req,
    res,
    reqModel: UserModel,
  });
  return res.status(statusCode.OK).json(result);
});
// =====================|| ADD EMAIL  ||==================================
const addEmailOrPhone = catchAsyncError(async (req, res, next) => {
  const result = await addEmailOrPhoneNumberFunc({
    req,
    res,
    reqModel: UserModel,
  });
  return res.status(statusCode.OK).json(result);
});

const saveDeviceTokens = catchAsyncError(async (req, res, next) => {
  const { token, deviceType } = req.body;

  const reqField = ["token", "deviceType"];
  validateRequestBody(reqField, req.body);

  const model = UserDeviceTokenModel;

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

  const model = UserDeviceTokenModel;

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
    reqModel: UserModel,
  });

  return res.status(statusCode.OK).json(result);
});
const verifyOTP = catchAsyncError(async (req, res, next) => {
  const result = await verifyOtpFunc({
    req,
    res,
    reqModel: UserModel,
    typeOfUser: TypeOfUser.USER,
  });
  const { accessToken, refreshToken, reqData } = result;
  return res.status(statusCode.OK).json(result);
});

module.exports = {
  registerUserWithOtp,
  verifyOTP,
  loginUser,
  logoutUser,
  refreshToken,
  registerUser,
  resendOtp,
  // verifyOTP,
  verifyStatus,
  addEmailOrPhone,
  saveDeviceTokens,
  removeDeviceTokens,
  verifyOTPWithoutAuth,
  resendOtpWithoutAuth,
  verifyEmailExist,
};

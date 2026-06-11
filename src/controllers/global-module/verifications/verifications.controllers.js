const catchAsyncError = require("../../../utils/response/catchAsyncError");
const ApiError = require("../../../utils/response/ApiError");
const statusCode = require("../../../utils/constants/statusCode");
const {
  validateEmail,
  validatePhoneNumber,
} = require("../../../utils/validation/forSchema");
const ApiResponse = require("../../../utils/response/ApiResponse");

const emailVerifyModel = require("../../../models/global-module/verifications/emailVerification.model");
const phoneNumberVerifyModel = require("../../../models/global-module/verifications/phoneNumberVerification");
const {
  sendOtpToEmail,
  sendOtpToPhone,
  verifyPhoneOtp,
  verifyEmailOtp: verifyEmailOtpUtil,
} = require("../../../utils/otpService/otpService");


const sendOtpEmailOrPhoneNumber = catchAsyncError(async (req, res) => {
  const { emailOrPhone } = req.body;

  if (!emailOrPhone) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter email or phone");
  }

  const isEmail = validateEmail(emailOrPhone);
  const isPhone = validatePhoneNumber(emailOrPhone);

  if (!isEmail && !isPhone) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Enter a valid email or phone number"
    );
  }

  const result = isEmail
    ? await sendOtpToEmail(emailOrPhone)
    : await sendOtpToPhone(emailOrPhone);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { expiresAt: result.expiresAt },
        `OTP sent successfully to ${isEmail ? "email" : "phone number"}`
      )
    );
});

// ==============================
// Verify Email OTP
// ==============================
const verifyEmailOtp = catchAsyncError(async (req, res) => {
  const { email, otp } = req.body;

  if (!email) throw new ApiError(statusCode.BAD_REQUEST, "Please enter email");
  if (!otp) throw new ApiError(statusCode.BAD_REQUEST, "Please enter OTP");
  if (!validateEmail(email)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Enter a valid email address");
  }

  // Delegates to util: validates record, expiry, marks OTP as used.
  await verifyEmailOtpUtil(email, otp);

  // Mark email as verified (same behavior as your previous code)
  await emailVerifyModel.findOneAndUpdate(
    { email },
    { verified: true, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    { upsert: true, new: true }
  );

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, {}, "Email verified successfully"));
});

// ==============================
// Verify Phone OTP
// ==============================
const verifyPhoneNumberOtp = catchAsyncError(async (req, res) => {
  const { phoneNumber, otp } = req.body;

  if (!phoneNumber)
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter phone number");
  if (!otp) throw new ApiError(statusCode.BAD_REQUEST, "Please enter OTP");
  if (!validatePhoneNumber(phoneNumber)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Enter a valid phone number");
  }

  // Delegates to util: validates record, expiry, marks OTP as used.
  await verifyPhoneOtp(phoneNumber, otp);

  // Mark phone as verified (same behavior as your previous code)
  await phoneNumberVerifyModel.findOneAndUpdate(
    { phoneNumber },
    { verified: true, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    { upsert: true, new: true }
  );

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, {}, "Phone number verified successfully")
    );
});

// ==============================
// Check email/phone is verified
// (reads from verification models, not OTPs)
// ==============================
const checkEmailorPhoneNumberIsVerified = catchAsyncError(async (req, res) => {
  const { emailOrPhone } = req.body;

  if (!emailOrPhone) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter email or phone");
  }

  const isEmail = validateEmail(emailOrPhone);
  const isPhone = validatePhoneNumber(emailOrPhone);

  if (!isEmail && !isPhone) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Enter a valid email or phone number"
    );
  }

  const now = new Date();
  let verifiedDoc = null;

  if (isEmail) {
    verifiedDoc = await emailVerifyModel.findOne({
      email: emailOrPhone,
      verified: true,
      expiresAt: { $gt: now },
    });
  } else {
    verifiedDoc = await phoneNumberVerifyModel.findOne({
      phoneNumber: emailOrPhone,
      verified: true,
      expiresAt: { $gt: now },
    });
  }

  if (!verifiedDoc) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `The provided ${isEmail ? "email" : "phone number"} is not verified`
    );
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { verified: true, expiresAt: verifiedDoc.expiresAt },
        `The provided ${isEmail ? "email" : "phone number"} is verified`
      )
    );
});

module.exports = {
  sendOtpEmailOrPhoneNumber,
  verifyEmailOtp,
  verifyPhoneNumberOtp,
  checkEmailorPhoneNumberIsVerified,
};

const ejs = require("ejs");
const path = require("path");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const ApiError = require("../../../utils/response/ApiError");
const statusCode = require("../../../utils/constants/statusCode");
const {
  validateEmail,
  validatePhoneNumber,
} = require("../../../utils/validation/forSchema");
const OtpModel = require("../../../models/global-module/otps/otps.model");
const {
  generateTokens,
  setTokenCookies,
} = require("../../../utils/jwtToken/generateTokens");
const logger = require("../../../utils/logger/logger");
const ApiResponse = require("../../../utils/response/ApiResponse");
const BlackListTokenModel = require("../../../models/global-module/blacklist-tokens/blacklist-token.model");
const { refresh_token_secret, node_env } = require("../../../config/config");
const jwt = require("jsonwebtoken");
const HotelManagerModel = require("../../../models/hotel-module/hotel-manager/hotel-manager.model");
const {
  saveDeviceToken,
  removeDeviceToken,
} = require("../../../utils/services/deviceToken.services");

const {
  validateRequestBody,
  getStatusMessage,
} = require("../../../utils/reqFunctions/reqFunction");
const emailVerifyModel = require("../../../models/global-module/verifications/emailVerification.model");
const phoneNumberVerifyModel = require("../../../models/global-module/verifications/phoneNumberVerification");
const HotelManagerDeviceTokenModel = require("../../../models/hotel-module/hotel-device-tokens/hotel-device-tokens.model");
const { TypeOfUser } = require("../../../utils/constants/constants");
const Wallet=require('../../../models/wallet-module/wallets.model')
const {
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
const generateUniqueCardNumber = require("../../../utils/customId/generateUniqueCardNumber");
const {BranchModel }= require("../../../models/admin-module/branch/branches.model")

const generateOtp = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// =====================|| REGISTER HOTEL-MANAGER ||==========================
const registerHotelManager = catchAsyncError(async (req, res, next) => {
  const { email, fullName, password, address, phoneNumber, branch } = req.body;

  const reqField = ["email", "fullName", "password", "address", "phoneNumber", "branch"];
  validateRequestBody(reqField, req.body);


  const branchDoc = await BranchModel.findById(branch);
  if (!branchDoc) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid branch selected");
  }

  // ✅ Check email and phone verification
  const isEmailVerified = await emailVerifyModel.findOne({ email, verified: true });
  const isPhoneNumberVerified = await phoneNumberVerifyModel.findOne({ phoneNumber, verified: true });

  if (!isEmailVerified || !isPhoneNumberVerified) {
    const missingVerification = !isEmailVerified ? "email" : "phone number";
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Please verify your ${missingVerification} before registering`
    );
  }

  // ✅ Check if user already exists
  const existingUser = await HotelManagerModel.findOne({
    $or: [{ email }, { phoneNumber }],
  }).select("-password");

  if (existingUser) {
    if (["approved", "processing"].includes(existingUser.verificationStatus)) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        getStatusMessage(existingUser.verificationStatus)
      );
    }

    const { accessToken, refreshToken } = await generateTokens(existingUser, TypeOfUser.HOTELMANAGER);
    setTokenCookies(res, accessToken, refreshToken);

    const populatedUser = await HotelManagerModel.findById(existingUser._id).populate("branch");

    return res
      .status(statusCode.OK)
      .json(new ApiResponse(statusCode.OK, { accessToken, refreshToken, hotelmanager: populatedUser }, "Data found"));
  }

  // ✅ Create new hotel manager
  const newUser = new HotelManagerModel({
    email,
    fullName,
    password,
    address,
    phoneNumber,
    branch: branchDoc._id,
  });

  await newUser.save();

  // ✅ Ensure wallet
  let wallet = await Wallet.findOne({ userId: newUser._id });
  if (!wallet) {
    wallet = await Wallet.create({
      userId: newUser._id,
      balance: 0,
      currency: process.env.MOMO_CURRENCY,
      cardNumber: await generateUniqueCardNumber(),
    });
  }

  // ✅ Populate branch before sending response
  const populatedUser = await HotelManagerModel.findById(newUser._id)
    .select("-password")
    .populate("branch");

  const { accessToken, refreshToken } = await generateTokens(newUser, TypeOfUser.HOTELMANAGER);
  setTokenCookies(res, accessToken, refreshToken);

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      { accessToken, refreshToken, hotelmanager: populatedUser },
      "Hotel Manager registered successfully"
    )
  );
});


// =====================|| LOGIN USER ||=====================================
const loginHotelManager = catchAsyncError(async (req, res, next) => {
  const { emailOrPhone, password } = req.body;

  if (!emailOrPhone) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter email or phone");
  }

  const isEmail = validateEmail(emailOrPhone);
  const isPhoneNumber = validatePhoneNumber(emailOrPhone);

  if (!isEmail && !isPhoneNumber) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Enter a valid email or phone number"
    );
  }

  if (!password) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter password");
  }

  // Check if the user already exists by email and phoneNumber
  const existingUser = await HotelManagerModel.findOne(
    isEmail ? { email: emailOrPhone } : { phoneNumber: emailOrPhone }
  );

  if (!existingUser) {
    throw new ApiError(statusCode.BAD_REQUEST, `User not found`);
  }
  if (
    existingUser?.verificationStatus === "processing" ||
    existingUser?.verificationStatus === "submitted" ||
    existingUser?.verificationStatus === "blocked" ||
    existingUser?.verificationStatus === "rejected" ||
    existingUser?.verificationStatus === "waiting-for-approval"
  ) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      `Your application is in ${existingUser.verificationStatus} state`
    );
  }

  if (existingUser?.password === undefined) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "You registered with OTP!. Please reset your password"
    );
  }

  const isPasswordMatch = await existingUser.comparePassword(password);

  if (!isPasswordMatch) {
    throw new ApiError(statusCode.BAD_REQUEST, `Invalid Credentials`);
  }

  const userObject = existingUser.toObject();
  delete userObject.password;

  const { accessToken, refreshToken } = await generateTokens(
    existingUser,
    TypeOfUser.HOTELMANAGER
  );
  setTokenCookies(res, accessToken, refreshToken);

  const data = {
    accessToken,
    refreshToken,
    // user: userObject,
  };

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, data, `Login Successfully`));
});

// =====================|| LOGOUT USER ||====================================
const logoutUser = catchAsyncError(async (req, res, next) => {
  const { accessToken, refreshToken } = req.cookies || req.body;

  if (!accessToken || !refreshToken) {
    throw new ApiError(statusCode.UNAUTHORIZED, {}, `Unauthorized`);
  }
  await BlackListTokenModel.create({ accessToken, refreshToken });

  const cookieOptions = {
    httpOnly: true,
    secure: node_env === "production",
    sameSite: "strict",
    expires: new Date(0),
  };

  res.cookie("accessToken", "", cookieOptions);
  res.cookie("refreshToken", "", cookieOptions);

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, {}, `Logout Successfully`));
});

// =====================|| REFRESH TOKEN ||==================================
const refreshToken = catchAsyncError(async (req, res, next) => {
  const token =
    req?.cookies?.refreshToken || req?.headers["authorization"]?.split(" ")[1];

  if (!token) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid refresh token");
  }
  const blackListedToken = await BlackListTokenModel.findOne({
    refreshToken: token,
  });
  if (blackListedToken) {
    logger.info("Blacklisted token found, returning unauthorized");
    throw new ApiError(statusCode.UNAUTHORIZED, "Please login to continue");
  }

  let decodedToken;
  try {
    decodedToken = jwt.verify(token, refresh_token_secret);
  } catch (error) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid or expired token");
  }
  const user = await HotelManagerModel.findOne({
    _id: decodedToken?._id,
  }).select("_id email roles verificationStatus authorities parentUserId");
  if (!user) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Hotel Manager  not found");
  }

  const { accessToken, refreshToken } = await generateTokens(
    user,
    TypeOfUser.HOTELMANAGER
  );
  setTokenCookies(res, accessToken, refreshToken);
  const data = {
    accessToken,
    refreshToken,
  };
  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        data,
        `Refresh Token successfully generated`
      )
    );
});

// =====================|| RESEND OTP ||=====================================
const resendOtp = catchAsyncError(async (req, res, next) => {
  const { emailOrPhone } = req.body;

  let targetEmailOrPhone;
  let isEmail = false;
  let isPhoneNumber = false;
  let isExistUser;

  if (emailOrPhone) {
    // Validate and set target contact
    isEmail = validateEmail(emailOrPhone);
    isPhoneNumber = validatePhoneNumber(emailOrPhone);

    if (!isEmail && !isPhoneNumber) {
      return res
        .status(statusCode.BAD_REQUEST)
        .json(
          new ApiResponse(
            statusCode.BAD_REQUEST,
            {},
            "Enter a valid email or phone number"
          )
        );
    }

    // Find user by email or phone
    const isUserExistWithThis = await HotelManagerModel.findOne(
      isEmail ? { email: emailOrPhone } : { phoneNumber: emailOrPhone }
    );

    if (isUserExistWithThis) {
      return res
        .status(statusCode.NOT_FOUND)
        .json(
          new ApiResponse(
            statusCode.NOT_FOUND,
            {},
            `User already exist with this ${isEmail ? "email" : "phoneNumber"}!`
          )
        );
    }

    targetEmailOrPhone = emailOrPhone;
  } else {
    // Find user by their ID (from req.user)
    isExistUser = await HotelManagerModel.findById(req.user._id);

    if (!isExistUser) {
      return res
        .status(statusCode.NOT_FOUND)
        .json(new ApiResponse(statusCode.NOT_FOUND, {}, "User not found"));
    }

    const { email, phoneNumber } = isExistUser;

    if (!email && !phoneNumber) {
      return res
        .status(statusCode.BAD_REQUEST)
        .json(
          new ApiResponse(
            statusCode.BAD_REQUEST,
            {},
            "User does not have a registered email or phone number"
          )
        );
    }

    // Set target based on availability
    targetEmailOrPhone = email || phoneNumber;
    isEmail = !!email;
    isPhoneNumber = !!phoneNumber;
  }

  const otp = "1234"; // Replace with "1234" for testing, if needed
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await OtpModel.findOneAndUpdate(
    { ownerId: req.user._id },
    { otp, expiresAt, isUsed: false },
    { upsert: true, new: true }
  );

  // Send response indicating where the OTP was sent
  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        {},
        `OTP is sent to ${
          emailOrPhone ? "provided" : "registered"
        } ${isEmail ? "email" : "phone number"}: ${targetEmailOrPhone}`
      )
    );
});

// =====================|| VERIFY OTP ||=====================================
const verifyOTP = catchAsyncError(async (req, res, next) => {
  logger.info("Verify OTP endpoint");
  const { emailOrPhone, otp } = req.body;
  const _id = req.user?._id;

  if (!otp) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter OTP");
  }
  const existingUser = await HotelManagerModel.findById(_id);
  if (!existingUser) {
    return res
      .status(statusCode.BAD_REQUEST)
      .json(new ApiError(statusCode.BAD_REQUEST, {}, `User not found`));
  }
  if (
    existingUser?.verificationStatus === "processing" ||
    existingUser?.verificationStatus === "blocked" ||
    existingUser?.verificationStatus === "rejected"
  ) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      {},
      `Your application is in ${existingUser.verificationStatus}`
    );
  }

  const otpInDb = await OtpModel.findOne({ ownerId: _id, isUsed: false });

  if (!otpInDb) {
    throw new ApiError(statusCode.NOT_FOUND, "Expired or used OTP");
  }

  if (otpInDb.otp !== otp) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid OTP");
  }

  otpInDb.isUsed = true;
  await otpInDb.save();

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, {}, `OTP is verified Successfully`));
});

// =====================|| CHECK YOUR APPLICATION STATUS ||======================
const verifyStatus = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;

  const user =
    await HotelManagerModel.findById(_id).select("verificationStatus");

  if (!user) {
    throw new ApiError(statusCode.INTERNAL_SERVER_ERROR, "User not found");
  }

  const data = {
    status: user.verificationStatus,
  };

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, data, "User verification status"));
});

// =====================|| ADD EMAIL  ||==================================
const addEmailOrPhone = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const { emailOrPhone, otp } = req.body;

  if (!emailOrPhone) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter email or phone");
  }

  const user = await HotelManagerModel.findById(_id);
  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  const isEmail = validateEmail(emailOrPhone);
  const isPhoneNumber = validatePhoneNumber(emailOrPhone);

  if (!isEmail && !isPhoneNumber) {
    return res
      .status(statusCode.BAD_REQUEST)
      .json(
        new ApiResponse(
          statusCode.BAD_REQUEST,
          {},
          "Enter a valid email or phone number"
        )
      );
  }

  const isUserExistWithThis = await HotelManagerModel.findOne(
    isEmail ? { email: emailOrPhone } : { phoneNumber: emailOrPhone }
  );

  if (isUserExistWithThis) {
    return res
      .status(statusCode.NOT_FOUND)
      .json(
        new ApiResponse(
          statusCode.NOT_FOUND,
          {},
          `User already exist with this ${isEmail ? "email" : "phoneNumber"}!`
        )
      );
  }

  const otpInDb = await OtpModel.findOne({ ownerId: _id, isUsed: false });

  if (!otpInDb) {
    throw new ApiError(statusCode.NOT_FOUND, "Expired or used OTP");
  }

  if (otpInDb.otp !== otp) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid OTP");
  }

  otpInDb.isUsed = true;
  if (isEmail) {
    user.email = emailOrPhone;
    otpInDb.isUsed = true;
  }
  if (isPhoneNumber) {
    user.phoneNumber = emailOrPhone;
    otpInDb.isUsed = true;
  }
  await otpInDb.save();
  await user.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        {},
        `User ${isEmail ? "email" : "Phone Number"} updated Successfully`
      )
    );
});

const saveDeviceTokens = catchAsyncError(async (req, res, next) => {
  const { token, deviceType } = req.body;

  const reqField = ["token", "deviceType"];
  validateRequestBody(reqField, req.body);

  const model = HotelManagerDeviceTokenModel;

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

  const model = HotelManagerDeviceTokenModel;

  const response = await removeDeviceToken(
    req.user._id,
    token,
    deviceType,
    model
  );
  return res.status(statusCode.OK).json(response);
});
const verifyOTPWithoutToken = catchAsyncError(async (req, res, next) => {
  const result = await verifyOtpWithoutTokenFunc({
    req,
    res,
    reqModel: HotelManagerModel,
  });
  return res.status(statusCode.OK).json(result);
});
// =====================|| RESEND OTP WITHOUT TOKEN ||=====================================
const resendOtpWithoutToken = catchAsyncError(async (req, res, next) => {
  const result = await resendOtpWithoutTokenFunc({
    req,
    res,
    reqModel: HotelManagerModel,
  });
  // Send response indicating where the OTP was sent
  return res.status(statusCode.OK).json(result);
});

const verifyEmailExist = catchAsyncError(async (req, res, next) => {
  const result = await verifyEmailExistFunc({
    req,
    res,
    reqModel: HotelManagerModel,
  });

  return res.status(statusCode.OK).json(result);
});

module.exports = {
  loginHotelManager,
  registerHotelManager,
  logoutUser,
  refreshToken,
  resendOtp,
  verifyOTP,
  verifyStatus,
  addEmailOrPhone,
  removeDeviceTokens,
  saveDeviceTokens,
  verifyOTPWithoutToken,
  resendOtpWithoutToken,
  verifyEmailExist,
};

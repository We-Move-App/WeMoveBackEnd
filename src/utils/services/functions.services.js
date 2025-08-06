const { node_env, refresh_token_secret } = require("../../config/config");
const BlackListTokenModel = require("../../models/global-module/blacklist-tokens/blacklist-token.model");
const emailVerifyModel = require("../../models/global-module/verifications/emailVerification.model");
const phoneNumberVerifyModel = require("../../models/global-module/verifications/phoneNumberVerification");
const statusCode = require("../constants/statusCode");
// const {
//   UserBankModel,
// } = require("../../../models/user-module/user-banks/user-banks.model");
const Wallet = require("../../models/wallet-module/wallets.model");
const generateUniqueCardNumber = require("../../utils/customId/generateUniqueCardNumber");
const {
  generateTokens,
  setTokenCookies,
} = require("../jwtToken/generateTokens");
const {
  validateRequestBody,
  getStatusMessage,
} = require("../reqFunctions/reqFunction");
const ApiError = require("../response/ApiError");
const ApiResponse = require("../response/ApiResponse");
const {
  validateEmail,
  validatePhoneNumber,
} = require("../validation/forSchema");
const jwt = require("jsonwebtoken");
const { getOtp } = require("./otps.services");
const OtpModel = require("../../models/global-module/otps/otps.model");
const { deleteImageFromAws } = require("../uploadFiles/uploadFilestoAws");
const {
  uploadSingleImageToAws,
} = require("../uploadFiles/images/uploadImages");
const { assignBranchToUserUsingGeolib } = require("./branches.services");
const {
  UserBankModel,
} = require("../../models/user-module/user-banks/user-banks.model");
const sendEmail = require("../emailService/sendEmail");
const SecurePinModel = require("../../models/global-module/secure-pins/secure-pins.model");
const {
  HotelManagerBankModel,
} = require("../../models/hotel-module/hotel-manager-banks/hotel-manager-banks.model");
const { WalletCurrencyEnum } = require("../constants/ENUM");

// ==============================================
const registerUserWithEmailAndPhoneNumber = async ({
  req,
  reqModel,
  typeOfUser,
  createdByAdmin = false, // Default to false if not provided
  res,
}) => {
  const { email,companyAddress,companyName, fullName, password, address, phoneNumber } = req.body;

  const reqField = ["email","companyName", "password", "phoneNumber"];
  validateRequestBody(reqField, req.body);

  if (!createdByAdmin) {
  // only verify email/phone if NOT created by admin
  const isEmailVerified = await emailVerifyModel.findOne({ email, verified: true });
  const isPhoneNumberVerified = await phoneNumberVerifyModel.findOne({ phoneNumber, verified: true });

  if (!isEmailVerified || !isPhoneNumberVerified) {
    const missingVerification = !isEmailVerified ? "email" : "phone number";
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Please verify your ${missingVerification} before registering`
    );
  }
}


  const existingUser = await reqModel
    .findOne({
      $or: [{ email }, { phoneNumber }],
    })
    .select("-password");

  if (existingUser) {
    if (["approved", "processing"].includes(existingUser.verificationStatus)) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        getStatusMessage(existingUser.verificationStatus)
      );
    }

    const userObject = existingUser.toObject();
    delete userObject.password;

    const { accessToken, refreshToken } = await generateTokens(
      existingUser,
      typeOfUser
    );

    setTokenCookies(res, accessToken, refreshToken);

    const data = {
      accessToken,
      refreshToken,
      user: existingUser,
    };

    return new ApiResponse(statusCode.OK, data, `Data found`);
  }

  const newUser = new reqModel({
    companyName,
    companyAddress,
    email,
    fullName,
    password,
    address,
    phoneNumber,
    emailVerified: true,
    phoneNumberVerified: true,
    verificationStatus: createdByAdmin ? "approved" : "submitted", 
    
  });

  await newUser.save();

  let wallet = await Wallet.findOne({ userId: newUser._id });
  if (!wallet) {
    wallet = await Wallet.create({
      userId: newUser._id,
      balance: 0,
      currency: process.env.MOMO_CURRENCY,
      cardNumber: await generateUniqueCardNumber(),
    });
  }

  const userObject = newUser.toObject();
  delete userObject.password;

  const { accessToken, refreshToken } = await generateTokens(
    newUser,
    typeOfUser
  );
  setTokenCookies(res, accessToken, refreshToken);

  const data = {
    accessToken,
    refreshToken,
    user: userObject,
  };

  return new ApiResponse(statusCode.OK, data, `Data found`);
};

const loginUserWithEmailAndPhoneNumber = async ({
  req,
  res,
  reqModel,
  typeOfUser,
}) => {
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

  const existingUser = await reqModel
    .findOne({
      $or: [{ email: emailOrPhone }, { phoneNumber: emailOrPhone }],
    })
    .select("+password");
  if (!existingUser) {
    throw new ApiError(statusCode.BAD_REQUEST, `User not found`);
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

  // Check verification status
  if (!["approved"].includes(existingUser.verificationStatus)) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      getStatusMessage(existingUser.verificationStatus)
    );
  }

  const userObject = existingUser.toObject();
  delete userObject.password;

  const { accessToken, refreshToken } = await generateTokens(
    existingUser,
    typeOfUser
  );
  setTokenCookies(res, accessToken, refreshToken);

  const data = {
    accessToken,
    refreshToken,
    // user: userObject,
  };
  return new ApiResponse(statusCode.OK, data, `Login Successfully`);
};

const logoutUserFunc = async ({ req, res }) => {
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

  return new ApiResponse(statusCode.OK, {}, `Logout Successfully`);
};

const refreshTokenFunc = async ({ req, res, reqModel, typeOfUser }) => {
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
  const user = await reqModel
    .findOne({
      _id: decodedToken?._id,
    })
    .select("_id email role verificationStatus authorities parentUserId");
  if (!user) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Driver not found");
  }

  const { accessToken, refreshToken } = await generateTokens(user, typeOfUser);
  setTokenCookies(res, accessToken, refreshToken);
  const data = {
    accessToken,
    refreshToken,
  };
  return new ApiResponse(
    statusCode.OK,
    data,
    `Refresh Token successfully generated`
  );
};

const resendOtpFunc = async ({ req, res, reqModel }) => {
  const { emailOrPhone } = req.body;

  let isEmail = false;
  let isPhoneNumber = false;
  let query = {};
  let otpData = {};

  if (emailOrPhone) {
    isEmail = validateEmail(emailOrPhone);
    isPhoneNumber = validatePhoneNumber(emailOrPhone);

    if (!isEmail && !isPhoneNumber) {
      return new ApiResponse(
        statusCode.BAD_REQUEST,
        {},
        "Enter a valid email or phone number"
      );
    }

    // const userExists = await reqModel.findOne(
    //   isEmail ? { email: emailOrPhone } : { phoneNumber: emailOrPhone }
    // );

    // if (userExists) {
    //   return new ApiResponse(
    //     statusCode.CONFLICT,
    //     {},
    //     `User already exists with this ${isEmail ? "email" : "phone number"}!`
    //   );
    // }

    // Define query and data for upsert
    if (isEmail) {
      query = { email: emailOrPhone };
      otpData.email = emailOrPhone;
    } else {
      query = { phoneNumber: emailOrPhone };
      otpData.phoneNumber = emailOrPhone;
    }
  } else {
    const user = await reqModel.findById(req.user._id);
    if (!user) {
      return new ApiResponse(statusCode.NOT_FOUND, {}, "User not found");
    }

    const { email, phoneNumber } = user;

    if (!email && !phoneNumber) {
      return new ApiResponse(
        statusCode.BAD_REQUEST,
        {},
        "User has no registered email or phone number"
      );
    }

    query = { ownerId: req.user._id };
    otpData.ownerId = req.user._id;
    otpData.email = email || undefined;
    otpData.phoneNumber = phoneNumber || undefined;
  }

  const otp = getOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await OtpModel.findOneAndUpdate(
    query,
    { ...otpData, otp, expiresAt, isUsed: false },
    { upsert: true, new: true }
  );

  return new ApiResponse(
    statusCode.OK,
    {},
    `OTP has been sent to ${emailOrPhone ? "provided" : "registered"} ${isEmail ? "email" : "phone number"}: ${emailOrPhone || otpData.email || otpData.phoneNumber}`
  );
};

const resendOtpWithoutTokenFunc = async ({ req, res, reqModel }) => {
  const { emailOrPhone } = req.body;

  let isEmail = false;
  let isPhoneNumber = false;
  let query = {};
  let otpData = {};

  isEmail = validateEmail(emailOrPhone);
  isPhoneNumber = validatePhoneNumber(emailOrPhone);

  if (!isEmail && !isPhoneNumber) {
    return new ApiResponse(
      statusCode.BAD_REQUEST,
      {},
      "Enter a valid email or phone number"
    );
  }

  // const userExists = await reqModel.findOne(
  //   isEmail ? { email: emailOrPhone } : { phoneNumber: emailOrPhone }
  // );

  // if (userExists) {
  //   return new ApiResponse(
  //     statusCode.CONFLICT,
  //     {},
  //     `User already exists with this ${isEmail ? "email" : "phone number"}!`
  //   );
  // }

  // Define query and data for upsert
  if (isEmail) {
    query = { email: emailOrPhone };
    otpData.email = emailOrPhone;
  } else {
    query = { phoneNumber: emailOrPhone };
    otpData.phoneNumber = emailOrPhone;
  }

  const otp = getOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await OtpModel.findOneAndUpdate(
    query,
    { ...otpData, otp, expiresAt, isUsed: false },
    { upsert: true, new: true }
  );

  return new ApiResponse(
    statusCode.OK,
    {},
    `OTP has been sent to ${emailOrPhone ? "provided" : "registered"} ${isEmail ? "email" : "phone number"}: ${emailOrPhone || otpData.email || otpData.phoneNumber}`
  );
};

// const verifyOtpFunc = async ({ req, reqModel, res }) => {
//   const { emailOrPhone, otp } = req.body;

//   console.log("req.body", req.body);

//   if (!otp) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Please enter OTP");
//   }

//   let query = {};
//   let user;

//   if (emailOrPhone) {
//     const isEmail = validateEmail(emailOrPhone);
//     const isPhoneNumber = validatePhoneNumber(emailOrPhone);

//     if (!isEmail && !isPhoneNumber) {
//       throw new ApiError(
//         statusCode.BAD_REQUEST,
//         "Invalid email or phone number"
//       );
//     }

//     query = isEmail ? { email: emailOrPhone } : { phoneNumber: emailOrPhone };

//     user = await reqModel.findOne(
//       isEmail ? { email: emailOrPhone } : { phoneNumber: emailOrPhone }
//     );

//     if (!user) {
//       throw new ApiError(
//         statusCode.NOT_FOUND,
//         "Please enter credentials which is registered"
//       );
//     }
//   } else {
//     if (!req.user?._id) {
//       throw new ApiError(statusCode.UNAUTHORIZED, "User not authenticated");
//     }

//     query = { ownerId: req.user._id };

//     user = await reqModel.findById(req.user._id);

//     if (!user) {
//       throw new ApiError(statusCode.NOT_FOUND, "User not found");
//     }
//   }

//   const otpInDb = await OtpModel.findOne({ ...query, isUsed: false });
//   console.log("otpInDb", otpInDb);

//   if (!otpInDb || otpInDb.otp !== otp || otpInDb.expiresAt < Date.now()) {
//     throw new ApiError(statusCode.UNAUTHORIZED, "Invalid or expired OTP");
//   }

//   if (!["approved", "submitted"].includes(user?.verificationStatus)) {
//     throw new ApiError(
//       statusCode.BAD_REQUEST,
//       getStatusMessage(user?.verificationStatus)
//     );
//   }

//   otpInDb.isUsed = true;
//   await otpInDb.save();

//   return new ApiResponse(
//     statusCode.OK,
//     { verificationStatus: user.verificationStatus },
//     "OTP verified successfully"
//   );
// };

// version 2 of the function to verify otp without token
const verifyOtpFunc = async ({ req, reqModel, res, typeOfUser }) => {
  const { email, phoneNumber, emailOrPhone, otp } = req.body;

  const identifier = emailOrPhone || email || phoneNumber;

  if (!otp) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter OTP");
  }

  let user;
  let query = {};

  if (identifier) {
    const isEmail = validateEmail(identifier);
    const isPhone = validatePhoneNumber(identifier);

    if (!isEmail && !isPhone) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "Invalid email or phone number"
      );
    }

    user = await reqModel.findOne(
      isEmail ? { email: identifier } : { phoneNumber: identifier }
    );

    if (!user) {
      throw new ApiError(statusCode.NOT_FOUND, "User not found");
    }

    query = { ownerId: user._id };
  } else {
    if (!req.user || !req.user._id) {
      throw new ApiError(statusCode.UNAUTHORIZED, "User not authenticated");
    }

    user = await reqModel.findById(req.user._id);
    if (!user) {
      throw new ApiError(statusCode.NOT_FOUND, "User not found");
    }

    query = { ownerId: req.user._id };
  }

  const otpInDb = await OtpModel.findOne({ ...query, isUsed: false });
  console.log("OTP from DB:", otpInDb);

  if (!otpInDb || otpInDb.otp !== otp || otpInDb.expiresAt < Date.now()) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid or expired OTP");
  }

  if (!["approved", "submitted"].includes(user.verificationStatus)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      getStatusMessage(user.verificationStatus)
    );
  }

  
  if (validateEmail(identifier)) {
    user.emailVerified = true;
  } else if (validatePhoneNumber(identifier)) {
    user.phoneVerified = true;
  }
  await user.save(); // ✅ Save updated verification flags

  // ✅ Create wallet if not exists
  let wallet = await Wallet.findOne({ userId: user._id });
  if (!wallet) {
    wallet = await Wallet.create({
      userId: user._id,
      balance: 0,
      currency: process.env.MOMO_CURRENCY,
      cardNumber: await generateUniqueCardNumber(),
    });
  }

  const { accessToken, refreshToken } = await generateTokens(user, typeOfUser);
  setTokenCookies(res, accessToken, refreshToken);

  const bankDetails = await UserBankModel.findOne({ userId: user._id });
  const isBankdetails = !!bankDetails;

  const pinDetails = await SecurePinModel.findOne({ userId: user._id });

  // ✅ Create userData AFTER updating and saving user
  const userData = {
    ...user.toObject(),
    isEmailVerified: !!user.emailVerified,
    isPhoneVerified: !!user.phoneVerified,
    bankDetails,
    isBankdetails,
    isPinExist: pinDetails ? true : false,
  };

  otpInDb.isUsed = true;
  await otpInDb.save();

  return new ApiResponse(
    statusCode.OK,
    { token: accessToken, refreshToken, user: userData },
    "OTP verified successfully"
  );
};

const verifyOtpWithoutTokenFunc = async ({ req, reqModel, res }) => {
  const { emailOrPhone, otp } = req.body;

  if (!otp) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter OTP");
  }

  let query = {};
  let user;

  const isEmail = validateEmail(emailOrPhone);
  const isPhoneNumber = validatePhoneNumber(emailOrPhone);

  if (!isEmail && !isPhoneNumber) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid email or phone number");
  }

  query = isEmail ? { email: emailOrPhone } : { phoneNumber: emailOrPhone };

  user = await reqModel.findOne(
    isEmail ? { email: emailOrPhone } : { phoneNumber: emailOrPhone }
  );

  if (!user) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "Please enter correct credentials which is registered with us"
    );
  }

  const otpInDb = await OtpModel.findOne({ ...query, isUsed: false });

  if (!otpInDb || otpInDb.otp !== otp || otpInDb.expiresAt < Date.now()) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid or expired OTP");
  }

  if (!["approved", "submitted"].includes(user?.verificationStatus)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      getStatusMessage(user?.verificationStatus)
    );
  }

  otpInDb.isUsed = true;
  await otpInDb.save();

  return new ApiResponse(
    statusCode.OK,
    { verificationStatus: user.verificationStatus },
    "OTP verified successfully"
  );
};

const checkUserVerificationStatus = async ({ req, res, reqModel }) => {
  const { _id } = req.user;

  const user = await reqModel.findById(_id).select("verificationStatus");

  if (!user) {
    throw new ApiError(statusCode.INTERNAL_SERVER_ERROR, "User not found");
  }

  const data = {
    status: user.verificationStatus,
  };

  return new ApiResponse(statusCode.OK, data, "User verification status");
};

const addEmailOrPhoneNumberFunc = async ({ req, res, reqModel }) => {
  const { _id } = req.user;
  const { emailOrPhone, otp } = req.body;

  if (!emailOrPhone) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter email or phone");
  }

  const user = await reqModel.findById(_id);
  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  const isEmail = validateEmail(emailOrPhone);
  const isPhoneNumber = validatePhoneNumber(emailOrPhone);

  if (!isEmail && !isPhoneNumber) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Enter a valid email or phone number"
    );
  }

  const isUserExistWithThis = await reqModel.findOne(
    isEmail ? { email: emailOrPhone } : { phoneNumber: emailOrPhone }
  );

  if (isUserExistWithThis) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `User already exists with this ${isEmail ? "email" : "phone number"}!`
    );
  }

  const otpInDb = await OtpModel.findOne({
    ...(isEmail && { email: emailOrPhone }),
    ...(isPhoneNumber && { phoneNumber: emailOrPhone }),
    ...(!isEmail && !isPhoneNumber && { ownerId: _id }),
    isUsed: false,
  });

  if (!otpInDb) {
    throw new ApiError(statusCode.NOT_FOUND, "Expired or used OTP");
  }

  if (otpInDb.otp !== otp) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid OTP");
  }

  // ✅ Update user and mark as verified
  if (isEmail) {
    user.email = emailOrPhone;
    user.emailVerified = true; // <-- Set verified
  }

  if (isPhoneNumber) {
    user.phoneNumber = emailOrPhone;
    user.phoneVerified = true; // <-- Set verified
  }

  otpInDb.isUsed = true;

  await Promise.all([otpInDb.save(), user.save()]);

  return new ApiResponse(
    statusCode.OK,
    {},
    `User ${isEmail ? "email" : "phone number"} updated and verified successfully`
  );
};

const getUserProfileFunc = async ({
  req,
  reqModel,
  reqDocModel,
  bankModel,
  res,
}) => {
  const { _id } = req.user;
  console.log(_id);

  const [user, documents, bankDetails, pinDetails] = await Promise.all([
    reqModel.findById(_id).select("-password").lean(),
    reqDocModel.findOne({ userId: _id }).populate("documentIds").lean(),
    bankModel.findOne({ userId: _id }).lean(),

    SecurePinModel.findOne({ userId: _id }),
  ]);

  // const pinDetails = await SecurePinModel.findOne({ userId: user._id });
  // console.log(pinDetails);

  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }
  const userData = {
    ...user,
    document: documents,
    bankDetails: bankDetails || null,
    isPinExist: pinDetails ? true : false,
  };

  return new ApiResponse(statusCode.OK, { user: userData }, "Profile found");
};

const getAvatarFunc = async ({ req, res, reqModel }) => {
  const { _id } = req.user;

  const user = await reqModel.findById(_id).select("avatar");

  return new ApiResponse(
    statusCode.OK,
    user.avatar,
    "Avatar fetched successfully"
  );
};

const changePasswordFunc = async ({ req, res, reqModel }) => {
  const { oldPassword, newPassword } = req.body;
  const _id = req?.user._id;
  if (!oldPassword || !newPassword) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please enter your old and new password"
    );
  }
  if (oldPassword === newPassword) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Both password are same. Please enter  different Password to proceed"
    );
  }
  const isUserExist = await reqModel.findById(_id);
  if (!isUserExist) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }
  if (!isUserExist.password) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "You are registered with OTP and cannot change your password. Please use OTP to authenticate."
    );
  }

  const isOldPasswordMatch = await isUserExist?.comparePassword(oldPassword);
  if (!isOldPasswordMatch) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Old password is incorrect.");
  }

  isUserExist.password = newPassword;
  await isUserExist.save();

  return new ApiResponse(statusCode.OK, {}, `Password updated Successfully`);
};

const setPasswordFieldFunc = async ({ req, res, reqModel }) => {
  const { newPassword } = req.body;
  const _id = req.user._id;

  if (!newPassword) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter your password");
  }
  const isUserExist = await reqModel.findById(_id);
  if (!isUserExist) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }
  if (!isUserExist.password) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "You are registered with OTP and cannot change your password. Please use OTP to authenticate."
    );
  }
  const isOldPasswordMatch = await isUserExist?.comparePassword(oldPassword);
  if (!isOldPasswordMatch) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Old password is incorrect.");
  }
  isUserExist.password = newPassword;
  await isUserExist.save();

  return new ApiResponse(statusCode.OK, {}, `Password updated Successfully`);
};

const resetPasswordFunc = async ({ req, res, reqModel }) => {
  const { emailOrPhone, otp, newPassword } = req.body;
  const { _id } = req.user;

  if (!otp) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter your OTP");
  }

  if (!emailOrPhone) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter email or phone");
  }

  const isEmail = validateEmail(emailOrPhone);
  const isPhoneNumber = validatePhoneNumber(emailOrPhone);

  const isUserExist = await reqModel.findOne(
    isEmail ? { email: emailOrPhone } : { phoneNumber: emailOrPhone }
  );

  if (!isUserExist) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  const otpInDb = await OtpModel.findOne({
    ...(isEmail && { email: emailOrPhone }),
    ...(isPhoneNumber && { phoneNumber: emailOrPhone }),
    ...(!isEmail && !isPhoneNumber && { ownerId: _id }),
    isUsed: false,
  });

  if (!otpInDb) {
    throw new ApiError(statusCode.NOT_FOUND, "Expired or used OTP");
  }

  if (otpInDb?.otp !== otp) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid OTP");
  }
  otpInDb.isUsed = true;

  isUserExist.password = newPassword;
  await otpInDb.save();
  await isUserExist.save();

  return new ApiResponse(statusCode.OK, {}, `Password reset Successfully`);
};

const resetPasswordFunc2 = async ({ req, res, reqModel }) => {
  const { emailOrPhone, password, confirmPassword } = req.body;

  if (!emailOrPhone) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter email or phone");
  }

  if (!password || !confirmPassword || password !== confirmPassword) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please enter password and confirm password and must be same"
    );
  }

  const isEmail = validateEmail(emailOrPhone);
  const isPhoneNumber = validatePhoneNumber(emailOrPhone);

  const isUserExist = await reqModel.findOne(
    isEmail ? { email: emailOrPhone } : { phoneNumber: emailOrPhone }
  );

  if (!isUserExist) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  const otpInDb = await OtpModel.findOne({
    ...(isEmail && { email: emailOrPhone }),
    ...(isPhoneNumber && { phoneNumber: emailOrPhone }),
    isUsed: true,
  });

  if (!otpInDb) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "Your otp is expired or first validate yourself"
    );
  }

  isUserExist.password = password;
  await isUserExist.save();
  await OtpModel.findOneAndDelete({ _id: otpInDb._id });

  return new ApiResponse(statusCode.OK, {}, `Password reset Successfully`);
};

const updateAvatarFunc = async ({ req, res, reqModel }) => {
  const { _id } = req.user;
  const { avatar } = req.files;

  if (!avatar || avatar.length === 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please select a file to upload"
    );
  }
  const user = await reqModel.findById(_id);
  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  if (user?.avatar?.public_id) {
    try {
      await deleteImageFromAws(user?.avatar?.public_id);
    } catch (error) {
      console.error("Error deleting image from Cloudinary:", error);
    }
  }

  let uploadImage;
  try {
    // uploadImage = await uploadImageOnCloudinary(avatar[0].path);
    uploadImage = await uploadSingleImageToAws(avatar);
  } catch (error) {
    console.error("Error uploading image to Cloudinary:", error);
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      "Failed to upload new avatar"
    );
  }
  user.avatar = uploadImage;
  if (user.role !== "user" && user?.verificationStatus === "submitted") {
    user.verificationStatus = "processing";
  }
  await user.save();

  return new ApiResponse(
    statusCode.OK,
    uploadImage,
    "Your profile picture has been updated successfully"
  );
};

// const registerUserWithEmailOrPhoneAndOtp = async ({
//   req,
//   res,
//   reqModel,
//   typeOfUser,
// }) => {
//   const { emailOrPhone } = req.body;

//   if (!emailOrPhone) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Please enter email or phone");
//   }
//   const isEmail = validateEmail(emailOrPhone);
//   const isPhoneNumber = validatePhoneNumber(emailOrPhone);
//   if (!isEmail && !isPhoneNumber) {
//     throw new ApiError(
//       statusCode.BAD_REQUEST,
//       "Enter a valid email or phone number"
//     );
//   }

//   const findOrCreateUser = async (field, value, role) => {
//     if (!value) {
//       throw new ApiError(
//         statusCode.BAD_REQUEST,
//         `${field} cannot be null or empty`
//       );
//     }
//     let user = await reqModel.findOne({ [field]: value });

//     if (!user) {
//       const userData =
//         field === "email" ? { email: value } : { phoneNumber: value };

//       user = new reqModel({
//         ...userData,
//       });
//       await user.save();
//     }

//     return user;
//   };
//   const userField = isEmail ? "email" : "phoneNumber";
//   const createdUser = await findOrCreateUser(userField, emailOrPhone);

//   const otp = getOtp();
//   // const emailData = { otp, name: createdUser?.fullName || "User" };
//   // const emailData = { otp, name: createdUser?.name || "User" };

//   if (isPhoneNumber) {
//     const response = await sendOtpToPhoneNumbers(emailOrPhone, otp);
//     if (!response.success) {
//       throw new ApiError(
//         statusCode.INTERNAL_SERVER_ERROR,
//         "OTP is failed to triggered"
//       );
//     }
//   }

//   if (isEmail) {
//     try {
//       await sendEmail({
//   to: createdUser?.email,
//   name: createdUser?.name || "User",
//   otp,
//   template: "otpTemplate.ejs",
// });
//     } catch (error) {
//       throw new ApiError(
//         statusCode.BAD_REQUEST,
//         "Error in sending email",
//         error
//       );
//     }
//   }

//   const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

//   await OtpModel.findOneAndUpdate(
//     { ownerId: createdUser?._id },
//     { otp, expiresAt, isUsed: false },
//     { upsert: true, new: true, setDefaultsOnInsert: true }
//   );

//   const { accessToken, refreshToken } = await generateTokens(
//     createdUser,
//     typeOfUser
//   );
//   setTokenCookies(res, accessToken, refreshToken);

//   const reqData = {
//     _id: createdUser?._id,
//     email: createdUser?.email,
//     role: createdUser?.role,
//     verificationStatus: createdUser?.verificationStatus,
//     avatar: createdUser?.avatar,
//     phoneNumber: createdUser?.phoneNumber,
//   };

//   return { accessToken, refreshToken, reqData };
// };
// version2 code for registerUserWithEmailOrPhoneAndOtp
const registerUserWithEmailOrPhoneAndOtp = async ({
  req,
  res,
  reqModel,
  typeOfUser,
}) => {
  try {
    const { emailOrPhone } = req.body;

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

    const findOrCreateUser = async (field, value, role) => {
      if (!value) {
        throw new ApiError(
          statusCode.BAD_REQUEST,
          `${field} cannot be null or empty`
        );
      }
      let user = await reqModel.findOne({ [field]: value });

      if (!user) {
        const userData =
          field === "email" ? { email: value } : { phoneNumber: value };

        user = new reqModel({
          ...userData,
        });
        await user.save();
      }

      return user;
    };
    const userField = isEmail ? "email" : "phoneNumber";
    const createdUser = await findOrCreateUser(userField, emailOrPhone);
    console.log(createdUser);

    const otp = getOtp();
    const emailData = { otp, name: createdUser?.fullName || "User" };
    // const emailData = { otp, name: createdUser?.name || "User" };

    // if (isPhoneNumber) {
    //   const response = await sendOtpToPhoneNumbers(emailOrPhone, otp);
    //   if (!response.success) {
    //     throw new ApiError(
    //       statusCode.INTERNAL_SERVER_ERROR,
    //       "OTP is failed to triggered"
    //     );
    //   }
    // }

    // if (isEmail) {
    //   try {
    //     const res = await sendEmailUsingNodemailer({
    //       to: createdUser?.email,
    //       params: emailData,
    //       template: "otpTemplate.ejs",
    //       subject: "Verification Code for WeMOVE",
    //     });
    //   } catch (error) {
    //     throw new ApiError(
    //       statusCode.BAD_REQUEST,
    //       "Error in sending email",
    //       error
    //     );
    //   }
    // }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const otpdd = await OtpModel.findOneAndUpdate(
      { ownerId: createdUser?._id },
      { otp, expiresAt, isUsed: false },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(otpdd);

    // const { accessToken, refreshToken } = await generateTokens(
    //   createdUser,
    //   typeOfUser
    // );
    // setTokenCookies(res, accessToken, refreshToken);

    // const reqData = {
    //   _id: createdUser?._id,
    //   email: createdUser?.email,
    //   role: createdUser?.role,
    //   verificationStatus: createdUser?.verificationStatus,
    //   avatar: createdUser?.avatar,
    //   phoneNumber: createdUser?.phoneNumber,
    // };

    // return { accessToken, refreshToken, reqData };
    return true;
  } catch (error) {
    return false;
  }
};

const assignBranchToUserFunc = async ({ req, res, reqModel }) => {
  const { latitude, longitude } = req.body;

  validateRequestBody(["latitude", "longitude"], req.body);

  const user = await reqModel.findById(req.user._id).populate("branch");

  if (user?.branch) {
    return new ApiResponse(
      statusCode.OK,
      { branch: user.branch },
      "Branch already assigned"
    );
  }

  const { success, nearest, distanceInKm, message } =
    await assignBranchToUserUsingGeolib(latitude, longitude);

  if (!success) {
    return new ApiResponse(
      statusCode.BAD_REQUEST,
      { nearest, distanceInKm },
      message || "Nearest branch is too far to assign"
    );
  }

  user.branch = nearest._id;
  await user.save();

  return new ApiResponse(
    statusCode.OK,
    { branch: nearest, distanceInKm },
    "Branch assigned successfully"
  );
};

const verifyEmailExistFunc = async ({ req, res, reqModel }) => {
  const { emailOrPhone } = req.query;

  if (!emailOrPhone) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please enter an email address or phone number"
    );
  }

  const isEmail = validateEmail(emailOrPhone);
  const isPhone = validatePhoneNumber(emailOrPhone);

  if (!isEmail && !isPhone) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please enter a valid email address or phone number"
    );
  }

  const query = isEmail
    ? { email: emailOrPhone }
    : { phoneNumber: emailOrPhone };
  console.log(query);

  const foundUser = await reqModel.findOne(query).select("email phoneNumber");

  if (!foundUser) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      isEmail ? "Email not found" : "Phone number not found"
    );
  }

  return new ApiResponse(
    statusCode.OK,
    {
      [isEmail ? "email" : "phoneNumber"]: emailOrPhone,
    },
    "User found"
  );
};

const updateUserLocationFunc = async ({ req, res, reqModel }) => {
  const userId = req.user._id;
  const { latitude, longitude, rideId } = req.body;

  if (latitude == null || longitude == null) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please enter a valid latitude and longitude"
    );
  }

  const existing = await reqModel.findOne({ userId });

  const data = {
    currentLocation: {
      type: "Point",
      coordinates: [longitude, latitude],
    },
    rideId,
  };

  let result;
  if (existing) {
    result = await reqModel.findOneAndUpdate({ userId }, data, { new: true });
  } else {
    result = await reqModel.create({ userId, ...data });
  }
  return new ApiResponse(statusCode.OK, result, "Location Update");
};

module.exports = {
  registerUserWithEmailAndPhoneNumber,
  registerUserWithEmailOrPhoneAndOtp,
  loginUserWithEmailAndPhoneNumber,
  logoutUserFunc,
  refreshTokenFunc,
  resendOtpFunc,
  checkUserVerificationStatus,
  addEmailOrPhoneNumberFunc,
  getUserProfileFunc,
  getAvatarFunc,
  changePasswordFunc,
  setPasswordFieldFunc,
  resetPasswordFunc,
  updateAvatarFunc,
  assignBranchToUserFunc,
  resetPasswordFunc2,
  verifyOtpWithoutTokenFunc,
  resendOtpWithoutTokenFunc,
  verifyEmailExistFunc,
  updateUserLocationFunc,
  verifyOtpFunc,
};

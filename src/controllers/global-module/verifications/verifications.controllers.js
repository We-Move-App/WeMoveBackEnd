const catchAsyncError = require("../../../utils/response/catchAsyncError");
const ApiError = require("../../../utils/response/ApiError");
const statusCode = require("../../../utils/constants/statusCode");
const {
  validateEmail,
  validatePhoneNumber,
} = require("../../../utils/validation/forSchema");
const OtpModel = require("../../../models/global-module/otps/otps.model");
const emailVerifyModel = require("../../../models/global-module/verifications/emailVerification.model");
const phoneNumberVerifyModel = require("../../../models/global-module/verifications/phoneNumberVerification");
const {
  sendOtpToPhoneNumbers,
  getOtp,
} = require("../../../utils/services/otps.services");
const {
  sendEmailUsingNodemailer,
} = require("../../../utils/services/email.services");
const ApiResponse = require("../../../utils/response/ApiResponse");
const UserModel = require("../../../models/user-module/users/user.model");

// const sendOtpEmailOrPhoneNumber = catchAsyncError(async (req, res, next) => {
//   const { emailOrPhone } = req.body;

//   if (!emailOrPhone) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Please enter email or phone");
//   }

//   const isEmail = validateEmail(emailOrPhone);
//   const isPhoneNumber = validatePhoneNumber(emailOrPhone);

//   if (!isEmail && !isPhoneNumber) {
//     return res
//       .status(statusCode.BAD_REQUEST)
//       .json(
//         new ApiResponse(
//           statusCode.BAD_REQUEST,
//           {},
//           "Enter a valid email or phone number"
//         )
//       );
//   }
//   const otp = getOtp();
//   const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
//   const updateFields = { otp, expiresAt, isUsed: false };
//   if (isEmail) {
//     await OtpModel.findOneAndUpdate(
//       { email: { $ne: null }, email: emailOrPhone },
//       updateFields,
//       { upsert: true, new: true }
//     );

//     const emailData = { otp, name: "User" };
//     let email = emailOrPhone;
//     try {
//       const emailResponse = await sendEmailUsingNodemailer({
//         to: email,
//         params: emailData,
//         template: "otpTemplate.ejs",
//         subject: "Verification Code for WeMOVE",
//       });
//     return res
//       .status(statusCode.OK)
//       .json(
//         new ApiResponse(
//           statusCode.OK,
//           {},
//           `OTP sent successfully to ${isEmail ? `email` : `phoneNumber`}: ${emailOrPhone}`
//         )
//       );
//     } catch (error) {
//       console.log(error);
//       throw new ApiError(
//         statusCode.BAD_REQUEST,
//         "Error in sending email",
//         error
//       );
//     }
//   }
//   if (isPhoneNumber) {
//     await OtpModel.findOneAndUpdate(
//       { phoneNumber: { $ne: null }, phoneNumber: emailOrPhone },
//       updateFields,
//       { upsert: true, new: true }
//     );

//     // const response = await sendOtpToPhoneNumbers(emailOrPhone, otp);
//     // if (!response.success) {
//     //   throw new ApiError(
//     //     statusCode.INTERNAL_SERVER_ERROR,
//     //     "OTP is failed to triggered"
//     //   );
//     // }
//     return res.status(statusCode.OK).json(
//       new ApiResponse(statusCode.OK, {
//         message: `OTP sent successfully to ${isEmail ? `email` : `phoneNumber`}: ${emailOrPhone}`,
//       })
//     );
//   }
// });

const sendOtpEmailOrPhoneNumber = catchAsyncError(async (req, res, next) => {
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

  // Generate OTP and Expiry
  const otp = getOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const updateFields = { otp, expiresAt, isUsed: false };

  // Store OTP in Database First
  await OtpModel.findOneAndUpdate(
    { ...(isEmail ? { email: emailOrPhone } : { phoneNumber: emailOrPhone }) },
    updateFields,
    { upsert: true, new: true }
  );

  // Respond Quickly
  res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        {},
        `OTP sent successfully to ${isEmail ? "email" : "phoneNumber"}: ${emailOrPhone}`
      )
    );

  // // Send OTP Email in Background
  // if (isEmail) {
  //   const emailData = { otp, name: "User" };
  //   sendEmailUsingNodemailer({
  //     to: emailOrPhone,
  //     params: emailData,
  //     template: "otpTemplate.ejs",
  //     subject: "Verification Code for WeMOVE",
  //   }).catch((error) => console.error("Email sending failed:", error));
  // }

  // // Send OTP SMS in Background
  // if (isPhoneNumber) {
  //   sendOtpToPhoneNumbers(emailOrPhone, otp).catch((error) =>
  //     console.error("SMS sending failed:", error)
  //   );
  // }
});

const verifyEmailOtp = catchAsyncError(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter email");
  }

  const isEmail = validateEmail(email);
  if (!isEmail) {
    throw new ApiError(statusCode.BAD_REQUEST, "Enter a valid email address");
  }

  let otpRecord = await OtpModel.findOne({ email });

  if (!otpRecord || otpRecord.otp !== otp || otpRecord.expiresAt < new Date()) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid or expired OTP");
  }

  await emailVerifyModel.findOneAndUpdate(
    { email },
    { verified: true, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    { upsert: true, new: true }
  );

  await OtpModel.deleteOne({ email }); // Remove OTP after verification
  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, {}, "Email verified successfully"));
});

const verifyPhoneNumberOtp = catchAsyncError(async (req, res, next) => {
  const { phoneNumber, otp } = req.body;

  if (!phoneNumber) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter phone number");
  }

  const isPhoneNumber = validatePhoneNumber(phoneNumber);
  if (!isPhoneNumber) {
    throw new ApiResponse(statusCode.BAD_REQUEST, "Enter a valid phone number");
  }

  let otpRecord = await OtpModel.findOne({ phoneNumber });

  if (!otpRecord || otpRecord.otp !== otp || otpRecord.expiresAt < new Date()) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid or expired OTP");
  }

  await phoneNumberVerifyModel.findOneAndUpdate(
    { phoneNumber },
    { verified: true, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    { upsert: true, new: true }
  );

  await OtpModel.deleteOne({ phoneNumber });

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, {}, "Phone number verified successfully")
    );
});


// const verifyOtpWithPasswordChange = catchAsyncError(async (req, res, next) => {
//   const { email, phoneNumber, otp, password } = req.body;

//   if (!otp) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Please provide OTP");
//   }

//   // Email verification flow
//   if (email) {
//     const isEmail = validateEmail(email);
//     if (!isEmail) {
//       throw new ApiError(statusCode.BAD_REQUEST, "Enter a valid email address");
//     }

//     const otpRecord = await OtpModel.findOne({ email });
//     if (!otpRecord || otpRecord.otp !== otp || otpRecord.expiresAt < new Date()) {
//       throw new ApiError(statusCode.BAD_REQUEST, "Invalid or expired OTP");
//     }

//      await UserModel.findOneAndUpdate

//     await OtpModel.deleteOne({ email });

//     return res
//       .status(statusCode.OK)
//       .json(new ApiResponse(statusCode.OK, {}, "Email verified successfully"));
//   }

//   // Phone number verification flow
//   if (phoneNumber) {
//     const isPhoneNumber = validatePhoneNumber(phoneNumber);
//     if (!isPhoneNumber) {
//       throw new ApiError(statusCode.BAD_REQUEST, "Enter a valid phone number");
//     }

//     const otpRecord = await OtpModel.findOne({ phoneNumber });
//     if (!otpRecord || otpRecord.otp !== otp || otpRecord.expiresAt < new Date()) {
//       throw new ApiError(statusCode.BAD_REQUEST, "Invalid or expired OTP");
//     }

//     await phoneNumberVerifyModel.findOneAndUpdate(
//       { phoneNumber },
//       { verified: true, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
//       { upsert: true, new: true }
//     );

//     await OtpModel.deleteOne({ phoneNumber });

//     return res
//       .status(statusCode.OK)
//       .json(new ApiResponse(statusCode.OK, {}, "Phone number verified successfully"));
//   }

//   // If neither email nor phoneNumber is provided
//   throw new ApiError(statusCode.BAD_REQUEST, "Please provide email or phone number");
// });


const checkEmailorPhoneNumberIsVerified = catchAsyncError(
  async (req, res, next) => {
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

    let isVerified = null;

    if (isEmail) {
      isVerified = await emailVerifyModel.findOne({
        email: emailOrPhone,
        verified: true,
      });
    } else if (isPhoneNumber) {
      isVerified = await phoneNumberVerifyModel.findOne({
        phoneNumber: emailOrPhone,
        verified: true,
      });
    }

    if (!isVerified) {
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
          { verified: true },
          `The provided ${isEmail ? "email" : "phone number"} is verified`
        )
      );
  }
);

module.exports = {
  sendOtpEmailOrPhoneNumber,
  verifyEmailOtp,
  verifyPhoneNumberOtp,
  checkEmailorPhoneNumberIsVerified,
};

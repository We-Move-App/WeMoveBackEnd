const OtpModel = require("../../../models/global-module/otps/otps.model");
const SecurePinModel = require("../../../models/global-module/secure-pins/secure-pins.model");
const UserModel = require("../../../models/user-module/users/user.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const { securePinValidator } = require("../../../utils/validation/forSchema");
const bcrypt = require("bcrypt");

const CreateSecurePin = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const { securePin, confirmSecurePin } = req.body;

  if (!securePin || !confirmSecurePin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please enter your 4 digit secure pin and confirm secure pin"
    );
  }

  if (securePin?.length !== 4 || confirmSecurePin?.length !== 4) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please enter Exactly 4 digit secure pin"
    );
  }
  const validSecurePin = securePinValidator(securePin);
  const validConfirmSecurePin = securePinValidator(confirmSecurePin);

  if (!validSecurePin || !validConfirmSecurePin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Enter valid Securep pin (only number)"
    );
  }

  if (securePin !== confirmSecurePin) {
    throw new ApiError(statusCode.BAD_REQUEST, "Both pin should match");
  }

  const isUser = await UserModel.findById(_id);

  if (!isUser) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  const securePinExist = await SecurePinModel.findOne({ userId: _id });

  if (securePinExist) {
    throw new ApiError(statusCode.CONFLICT, "Pin already exists");
  }

  const createSecurePin = new SecurePinModel({
    userId: _id,
    securePin,
  });
  await createSecurePin.save();
  isUser.verificationStatus = "submitted";

  await isUser.save();

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        verificationStatus: isUser.verificationStatus,
      },
      `Secure Pin created Successfully`
    )
  );
});

const ChangeSecurePin = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const { oldSecurePin, newSecurePin, confirmSecurePin } = req.body;

  // Validate required fields
  if (!oldSecurePin || !newSecurePin || !confirmSecurePin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please enter old, new and confirm secure pin"
    );
  }

  // Validate length
  if (
    oldSecurePin?.length !== 4 ||
    newSecurePin?.length !== 4 ||
    confirmSecurePin?.length !== 4
  ) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "All secure PINs must be exactly 4 digits long."
    );
  }

  // Ensure new pins match
  if (newSecurePin !== confirmSecurePin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "New Secure Pin and Confirm Secure Pin do not match"
    );
  }

  // Prevent same pin reuse
  if (oldSecurePin === newSecurePin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "New Secure Pin cannot be same as Old Secure Pin"
    );
  }

  // Validate number-only format
  if (
    !securePinValidator(oldSecurePin) ||
    !securePinValidator(newSecurePin) ||
    !securePinValidator(confirmSecurePin)
  ) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Enter valid Secure Pin (only numbers allowed)"
    );
  }

  // Fetch user's current pin
  const securePinData = await SecurePinModel.findOne({ userId: _id });

  if (!securePinData) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "Secure Pin not found for this user"
    );
  }

  // Verify old pin
  const isOldPinMatch = await bcrypt.compare(
    oldSecurePin,
    securePinData.securePin
  );

  if (!isOldPinMatch) {
    throw new ApiError(statusCode.BAD_REQUEST, "Old Secure Pin is incorrect.");
  }

  // Save new pin (hashing handled by pre-save hook)
  securePinData.securePin = newSecurePin;
  await securePinData.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, {}, `Secure Pin updated successfully`)
    );
});

const ResetSecurePin = catchAsyncError(async (req, res, next) => {
  const { newSecurePin, confirmSecurePin } = req.body;
  const { _id } = req.user;

  if (!newSecurePin || !confirmSecurePin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please enter your new PIN, and confirm PIN"
    );
  }

  if (newSecurePin?.length !== 4 || confirmSecurePin?.length !== 4) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Both new and confirm PINs must be exactly 4 digits long"
    );
  }

  const validatePIN = securePinValidator(newSecurePin);
  const validateConfirm = securePinValidator(confirmSecurePin);
  if (!validatePIN || !validateConfirm) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Enter valid PIN (only numbers)"
    );
  }

  if (newSecurePin !== confirmSecurePin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "New PIN and confirm PIN do not match"
    );
  }

  // ✅ Find user
  const user = await UserModel.findById(_id);
  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  // // ✅ OTP query
  // let otpQuery = { otp, isUsed: false };
  // if (user.email) otpQuery.email = user.email.toLowerCase();
  // else if (user.phoneNumber) otpQuery.phoneNumber = user.phoneNumber;

  // const otpData = await OtpModel.findOne(otpQuery);

  // if (!otpData) throw new ApiError(statusCode.BAD_REQUEST, "Wrong OTP");
  // if (new Date(otpData.expiresAt) < new Date())
  //   throw new ApiError(statusCode.BAD_REQUEST, "Expired OTP");

  // ✅ Update secure PIN
  const securePinData = await SecurePinModel.findOne({ userId: _id });
  if (!securePinData)
    throw new ApiError(
      statusCode.NOT_FOUND,
      "Secure PIN not found for this user"
    );

  securePinData.securePin = newSecurePin;

  await securePinData.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, {}, "Secure PIN updated successfully")
    );
});

module.exports = { CreateSecurePin, ChangeSecurePin, ResetSecurePin };

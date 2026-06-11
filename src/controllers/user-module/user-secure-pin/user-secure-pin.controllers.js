const OtpModel = require("../../../models/global-module/otps/otps.model");
const SecurePinModel = require("../../../models/global-module/secure-pins/secure-pins.model");
const UserModel = require("../../../models/user-module/users/user.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const { translateLn } = require("../../../utils/services/translator.service");
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
  const ln = req.get("ln") || "en";

  // Validate required fields
  if (!oldSecurePin || !newSecurePin || !confirmSecurePin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ENTER_OLD_NEW_CONFIRM_SECURE_PIN")
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
      translateLn(ln, "SECURE_PIN_LENGTH_INVALID")
    );
  }

  // Ensure new pins match
  if (newSecurePin !== confirmSecurePin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "SECURE_PIN_MISMATCH")
    );
  }

  // Prevent same pin reuse
  if (oldSecurePin === newSecurePin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "SECURE_PIN_SAME_AS_OLD")
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
      translateLn(ln, "INVALID_SECURE_PIN_FORMAT")
    );
  }

  // Fetch user's current pin
  const securePinData = await SecurePinModel.findOne({ userId: _id });

  if (!securePinData) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "SECURE_PIN_NOT_FOUND")
    );
  }

  // Verify old pin
  const isOldPinMatch = await bcrypt.compare(
    oldSecurePin,
    securePinData.securePin
  );

  if (!isOldPinMatch) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "OLD_SECURE_PIN_INCORRECT")
    );
  }

  // Save new pin (hashing handled by pre-save hook)
  securePinData.securePin = newSecurePin;
  await securePinData.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        {},
        translateLn(ln, "SECURE_PIN_UPDATED_SUCCESSFULLY")
      )
    );
});

const ResetSecurePin = catchAsyncError(async (req, res, next) => {
  const { newSecurePin, confirmSecurePin } = req.body;
  const { _id } = req.user;
  const ln = req.get("ln") || "en";

  if (!newSecurePin || !confirmSecurePin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ENTER_NEW_AND_CONFIRM_PIN")
    );
  }

  if (newSecurePin?.length !== 4 || confirmSecurePin?.length !== 4) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "NEW_AND_CONFIRM_PIN_LENGTH_INVALID")
    );
  }

  const validatePIN = securePinValidator(newSecurePin);
  const validateConfirm = securePinValidator(confirmSecurePin);
  if (!validatePIN || !validateConfirm) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "INVALID_SECURE_PIN_FORMAT")
    );
  }

  if (newSecurePin !== confirmSecurePin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "SECURE_PIN_MISMATCH")
    );
  }

  // ✅ Find user
  const user = await UserModel.findById(_id);
  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, translateLn(ln, "USER_NOT_FOUND"));
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
      translateLn(ln, "SECURE_PIN_NOT_FOUND")
    );

  securePinData.securePin = newSecurePin;

  await securePinData.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        {},
        translateLn(ln, "SECURE_PIN_UPDATED_SUCCESSFULLY")
      )
    );
});

module.exports = { CreateSecurePin, ChangeSecurePin, ResetSecurePin };

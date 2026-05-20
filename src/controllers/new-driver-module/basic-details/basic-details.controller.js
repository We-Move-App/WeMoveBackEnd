const statusCode = require("../../../utils/constants/statusCode");
const bcrypt = require("bcryptjs");
const {
  decodeAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  addBasicDetailsValidation,
} = require("../validations/basic-details.validation");

const DriverBasicDetails = require("../../../models/new-driver-module/basic-details/basic-details.model");
const DriverDocDetails = require("../../../models/new-driver-module/documents/driver-documents.model");
const DriverBankDetails = require("../../../models/new-driver-module/bank-details/bank-details.model");
const VehicleDetails = require("../../../models/new-driver-module/vehicle-details/vehicle-details.model");
const DriverLocations = require("../../../models/new-driver-module/location/driver-location.model");
const {
  DriverDocStatusEnum,
  DriverDocEnum,
  LnEnum,
} = require("../../../utils/constants/ENUM");
const {
  getDriverBasicWithDocs,
} = require("../aggregations/basic-details.aggregations");
const InactiveDriverModel = require("../../../models/new-driver-module/basic-details/inactive-drivers.model");
const {
  sendOtpToPhone,
  verifyPhoneOtp,
  sendOtpToEmail,
  verifyEmailOtp,
} = require("../../../utils/otpService/otpService");
const DriverHistory = require("../../../models/new-driver-module/basic-details/driverHistory.model");
const { translateLn } = require("../../../utils/services/translator.service");

const addDriverBasicDetails = catchAsyncError(async (req, res) => {
  const { error, value } = addBasicDetailsValidation.validate(req.body, {
    abortEarly: false,
  });
  console.log(...Object.entries(value));

  if (error) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      error.details.map((e) => e.message).join(", ")
    );
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded?.driverId;
  if (!driverId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const driverExists = await DriverBasicDetails.exists({ driverId });
  if (!driverExists) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  const driverUpdate = DriverBasicDetails.updateOne(
    { driverId },
    {
      $set: {
        ...value,
        updatedAt: new Date(),
      },
    }
  );

  const existingDocEntry = await DriverDocDetails.findOne({ driverId });

  let updatedDocuments = [];

  if (!existingDocEntry) {
    updatedDocuments = value.documents.map((doc) => ({
      ...doc,
      status: DriverDocStatusEnum.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await Promise.all([
      driverUpdate,
      DriverDocDetails.create({ driverId, documents: updatedDocuments }),
    ]);
  } else {
    const docMap = new Map();
    existingDocEntry.documents.forEach((doc) =>
      docMap.set(doc.documentType, doc)
    );

    value.documents.forEach((doc) => {
      docMap.set(doc.documentType, {
        ...docMap.get(doc.documentType),
        documentType: doc.documentType,
        fileUrl: doc.fileUrl,
        status: "pending",
        updatedAt: new Date(),
      });
    });

    updatedDocuments = Array.from(docMap.values());

    await Promise.all([
      driverUpdate,
      DriverDocDetails.updateOne(
        { driverId },
        { $set: { documents: updatedDocuments, updatedAt: new Date() } }
      ),
    ]);
  }

  const aggregatedData = await getDriverBasicWithDocs(driverId, [
    DriverDocEnum.IDCARD,
    DriverDocEnum.LICENSE,
  ]);

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        aggregatedData,
        "Basic details added successfully"
      )
    );
});

const getDriverBasicDetails = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded?.driverId;

  if (!driverId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const driverExists = await DriverBasicDetails.exists({ driverId });

  if (!driverExists) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  const aggregatedData = await getDriverBasicWithDocs(driverId, [
    DriverDocEnum.IDCARD,
    DriverDocEnum.LICENSE,
  ]);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        aggregatedData,
        "Driver basic details fetched successfully"
      )
    );
});

const getDriverProfileDetails = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded?.driverId;

  if (!driverId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const basicDetails = await DriverBasicDetails.findOne({ driverId }).lean();
  const bankDetails = await DriverBankDetails.findOne({ driverId }).lean();
  const vehicleDetails = await VehicleDetails.findOne({ driverId }).lean();
  const docGroup = await DriverDocDetails.findOne({ driverId }).lean();

  const driverLocation = await DriverLocations.findOne({ driverId }).lean();
  const isOnline = driverLocation?.status === "online";

  if (!basicDetails) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  // Group documents by type
  const allDocs = docGroup?.documents || [];

  // Helper to find doc by type
  const findDoc = (type) =>
    allDocs.find((doc) => doc.documentType === type) || null;

  // Attach filtered documents to each section
  const response = {
    success: true,
    message: "Driver profile fetched successfully",
    data: {
      basicDetails: {
        ...basicDetails,
        isOnline,
        id_card: findDoc("id_card"),
        license: findDoc("license"),
        avatar: findDoc("avatar"),
      },
      bankDetails: bankDetails
        ? {
            ...bankDetails,
            passbook: findDoc("passbook"),
          }
        : null,
      vehicleDetails: vehicleDetails
        ? {
            ...vehicleDetails,
            insurance: findDoc("insurance"),
            registration: findDoc("registration"),
            vehicle_photo: findDoc("vehicle_photo"),
          }
        : null,
    },
  };

  return res.status(statusCode.OK).json(response);
});

const addPin = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded?.driverId;

  if (!driverId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const driver = await DriverBasicDetails.findOne({ driverId });
  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  const { pin, confirmPin } = req.body;
  if (!pin || !confirmPin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Pin and confirmPin are required"
    );
  }

  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Pin must be a 4-digit number");
  }

  if (pin !== confirmPin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Pin and confirmPin do not match"
    );
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPin = await bcrypt.hash(pin, salt);

  driver.pin = hashedPin;
  driver.isPinExist = true;
  await driver.save();

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        driverId: driver.driverId,
        isPinExist: driver.isPinExist,
      },
      "Pin set successfully"
    )
  );
});

const updatePin = catchAsyncError(async (req, res) => {
  // ----------------- Step 1: Token Validation -----------------
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }
  const ln = req.get("ln") || "en";

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded?.driverId;

  if (!driverId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  // ----------------- Step 2: Fetch Driver -----------------
  const driver = await DriverBasicDetails.findOne({ driverId });
  if (!driver) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "DRIVER_NOT_FOUND")
    );
  }

  if (!driver.isPinExist || !driver.pin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "SECURE_PIN_NOT_SET")
    );
  }

  // ----------------- Step 3: Extract Body -----------------
  const { oldPin, newPin, confirmPin } = req.body;
  if (!oldPin || !newPin || !confirmPin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ENTER_NEW_AND_CONFIRM_PIN")
    );
  }

  // ----------------- Step 4: Verify Old Pin -----------------
  const isMatch = await bcrypt.compare(oldPin, driver.pin);
  if (!isMatch) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "OLD_SECURE_PIN_INCORRECT")
    );
  }

  // ----------------- Step 5: Validate New Pin -----------------
  if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "SECURE_PIN_LENGTH_INVALID")
    );
  }

  if (newPin !== confirmPin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "SECURE_PIN_MISMATCH")
    );
  }

  if (oldPin === newPin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "SECURE_PIN_SAME_AS_OLD")
    );
  }

  // ----------------- Step 6: Hash and Save New Pin -----------------
  const salt = await bcrypt.genSalt(10);
  const hashedPin = await bcrypt.hash(newPin, salt);

  driver.pin = hashedPin;
  await driver.save();

  // ----------------- Step 7: Response -----------------
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

const verifyPin = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const ln = (req.headers["ln"] || "en").toLowerCase();

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded?.driverId;

  if (!driverId) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      translateLn(ln, "INVALID_TOKEN")
    );
  }

  const driver = await DriverBasicDetails.findOne({ driverId });
  if (!driver) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "DRIVER_NOT_FOUND")
    );
  }

  if (!driver.isPinExist || !driver.pin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "SECURE_PIN_NOT_SET")
    );
  }

  const { pin } = req.body;
  if (!pin) {
    throw new ApiError(statusCode.BAD_REQUEST, translateLn(ln, "PIN_REQUIRED"));
  }

  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Pin must be a 4-digit number");
  }

  // ✅ Blocking logic starts
  if (driver.blockUntil && driver.blockUntil > new Date()) {
    const remaining = Math.ceil((driver.blockUntil - new Date()) / 1000);
    throw new ApiError(
      statusCode.FORBIDDEN,
      translateLn(ln, "TOO_MANY_OTP_VERIFY_REQUEST")
    );
  }

  const isMatch = await bcrypt.compare(pin, driver.pin);

  if (isMatch) {
    driver.failedAttempts = 0;
    driver.blockUntil = null;
    driver.blockStage = 0;
    await driver.save();

    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(
          statusCode.OK,
          { driverId: driver.driverId },
          translateLn(ln, "PIN_VERIFIED_SUCCESSFULLY")
        )
      );
  }

  // If not valid -> increase failed attempts
  driver.failedAttempts = (driver.failedAttempts || 0) + 1;
  let blockDuration = null;

  if (driver.blockStage === 0 && driver.failedAttempts >= 5) {
    blockDuration = 60 * 1000; // 1 min
    driver.blockStage = 1;
    driver.failedAttempts = 0;
  } else if (driver.blockStage === 1 && driver.failedAttempts >= 3) {
    blockDuration = 5 * 60 * 1000; // 5 min
    driver.blockStage = 2;
    driver.failedAttempts = 0;
  } else if (driver.blockStage === 2 && driver.failedAttempts >= 3) {
    blockDuration = 24 * 60 * 60 * 1000; // 1 day
    driver.blockStage = 3;
    driver.failedAttempts = 0;
  }

  if (blockDuration) {
    driver.blockUntil = new Date(Date.now() + blockDuration);
  }

  await driver.save();

  throw new ApiError(statusCode.BAD_REQUEST, translateLn(ln, "INVALID_PIN"));
});

const resetSecurePin = catchAsyncError(async (req, res) => {
  // ----------------- Step 1: Token Validation -----------------
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }
  const ln = req.get("ln") || "en";

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded?.driverId;

  if (!driverId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  // ----------------- Step 2: Fetch Driver -----------------
  const driver = await DriverBasicDetails.findOne({ driverId });
  if (!driver) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "DRIVER_NOT_FOUND")
    );
  }

  // ----------------- Step 3: Extract Body -----------------
  const { newPin, confirmPin } = req.body;
  if (!newPin || !confirmPin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ENTER_NEW_AND_CONFIRM_PIN")
    );
  }

  // ----------------- Step 5: Validate New Pin -----------------
  if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "SECURE_PIN_LENGTH_INVALID")
    );
  }

  if (newPin !== confirmPin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "SECURE_PIN_MISMATCH")
    );
  }

  // ----------------- Step 6: Hash and Save New Pin -----------------
  const salt = await bcrypt.genSalt(10);
  const hashedPin = await bcrypt.hash(newPin, salt);

  driver.pin = hashedPin;
  driver.isPinExist = true;
  driver.failedAttempts = 0;
  driver.blockUntil = null;
  driver.blockStage = 0;

  await driver.save();

  // ----------------- Step 7: Response -----------------
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

const deleteDriverProfile = catchAsyncError(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token missing or invalid"
    );
  }

  const token = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(token);
  const driverId = decoded?.driverId;

  if (!driverId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const driver = await DriverBasicDetails.findOne({ driverId });
  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  await InactiveDriverModel.create({
    originalDriverId: driver._id,
    driverId: driver.driverId,
    fullName: driver.fullName,
    phoneNo: driver.phoneNo,
    email: driver.email,
    gender: driver.gender,
    dob: driver.dob,
    branch: driver.branch,
    createdBy: driver.createdBy,
    createdById: driver.createdById,
    reason: "Driver requested account deletion",
  });

  await Promise.all([
    DriverBasicDetails.findOneAndDelete({ driverId }),
    DriverBankDetails.findOneAndDelete({ driverId }),
    VehicleDetails.findOneAndDelete({ driverId }),
  ]);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        null,
        "Driver deleted and archived successfully"
      )
    );
});

const updateDriverPhoneNumber = catchAsyncError(async (req, res) => {
  const ln = req.get("ln") || "en";

  const authHeader = req.headers.authorization;

  // ✅ Step 1: Validate token header
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      translateLn(ln, "INVALID_TOKEN")
    );
  }

  // ✅ Step 2: Decode token to extract driverId
  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  console.log("Decoded Token:", decoded);

  const driverId = decoded.driverId;
  console.log("Driver ID from Token:", driverId);
  const { newPhoneNumber, otp } = req.body;

  if (!newPhoneNumber || !otp) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "DRIVER_PHONE_UPDATE_REQUIRED_FIELDS")
    );
  }

  // ✅ Step 3: Verify OTP for new phone number
  await verifyPhoneOtp(newPhoneNumber, otp, ln);

  // ✅ Step 4: Fetch driver details
  const driver = await DriverBasicDetails.findOne({ driverId });
  if (!driver) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "DRIVER_NOT_FOUND")
    );
  }

  // ✅ Step 5: Prevent duplicate phone numbers
  const existingDriver = await DriverBasicDetails.findOne({
    phoneNo: newPhoneNumber,
  });

  // Prevent updating to the same phone number
  if (driver.phoneNo === newPhoneNumber) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "SAME_PHONE_NUMBER")
    );
  }

  if (existingDriver && String(existingDriver.driverId) !== String(driverId)) {
    throw new ApiError(
      statusCode.CONFLICT,
      translateLn(ln, "PHONE_NUMBER_ALREADY_REGISTERED")
    );
  }

  // ✅ Step 6: Log the change in history
  await DriverHistory.create({
    driverId: driver.driverId,
    previousPhoneNumber: driver.phoneNo,
    newPhoneNumber,
    changedBy: "driver",
  });

  // ✅ Step 7: Update driver phone number
  driver.phoneNo = newPhoneNumber;
  await driver.save();

  // ✅ Step 8: Respond success
  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        driverId: driver.driverId,
        phoneNo: driver.phoneNo,
      },
      "Phone number updated successfully"
    )
  );
});

const updateDriverEmail = catchAsyncError(async (req, res) => {
  const ln = req.get("ln") || "en";
  const authHeader = req.headers.authorization;

  // Step 1: Validate token
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      translateLn(ln, "TOKEN_INVALID")
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded.driverId;

  if (!driverId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Valid token is required");
  }

  const { newEmail, otp } = req.body;

  if (!newEmail || !otp) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "NEW_EMAIL_AND_OTP_REQUIRED")
    );
  }

  // Step 2: Fetch driver
  const driver = await DriverBasicDetails.findOne({ driverId });
  if (!driver) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "DRIVER_NOT_FOUND")
    );
  }

  // Step 3: Prevent updating to the same email
  if (driver.email === newEmail.toLowerCase()) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "NEW_EMAIL_SAME_AS_CURRENT")
    );
  }

  // Step 4: Prevent using another driver's email
  const existingDriver = await DriverBasicDetails.findOne({
    email: newEmail.toLowerCase(),
  });
  if (existingDriver && String(existingDriver.driverId) !== String(driverId)) {
    throw new ApiError(
      statusCode.CONFLICT,
      translateLn(ln, "EMAIL_ALREADY_REGISTERED_WITH_ANOTHER_DRIVER")
    );
  }

  // Step 5: Verify OTP for the new email
  await verifyEmailOtp(newEmail, otp, ln); // Implement similar to verifyPhoneOtp

  // Step 6: Log change in history
  await DriverHistory.create({
    driverId: driver.driverId,
    previousEmail: driver.email,
    newEmail: newEmail.toLowerCase(),
    changedBy: "driver",
  });

  // Step 7: Update driver's email
  driver.email = newEmail.toLowerCase();
  await driver.save();

  // Step 8: Respond success
  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        driverId: driver.driverId,
        email: driver.email,
      },
      "Email updated successfully"
    )
  );
});

const changeLanguage = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;

  // Step 1: Validate token
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded.driverId;

  if (!driverId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Valid token is required");
  }

  const driver = await DriverBasicDetails.findOne({ driverId });
  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  const { ln } = req.body;
  if (!Object.values(LnEnum).includes(ln)) {
    throw new ApiError(statusCode.NOT_FOUND, "Invalid Language type");
  }

  driver.ln = ln;

  await driver.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { ln: driver.ln },
        "Language Changed successfully"
      )
    );
});

module.exports = {
  addDriverBasicDetails,
  getDriverBasicDetails,
  getDriverProfileDetails,
  addPin,
  verifyPin,
  updatePin,
  resetSecurePin,
  deleteDriverProfile,
  updateDriverPhoneNumber,
  updateDriverEmail,
  changeLanguage,
};

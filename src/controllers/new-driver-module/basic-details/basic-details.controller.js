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
} = require("../../../utils/constants/ENUM");
const {
  getDriverBasicWithDocs,
} = require("../aggregations/basic-details.aggregations");

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

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded?.driverId;

  if (!driverId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  // ----------------- Step 2: Fetch Driver -----------------
  const driver = await DriverBasicDetails.findOne({ driverId });
  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  if (!driver.isPinExist || !driver.pin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "No existing pin found. Please create a pin first."
    );
  }

  // ----------------- Step 3: Extract Body -----------------
  const { oldPin, newPin, confirmPin } = req.body;
  if (!oldPin || !newPin || !confirmPin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "oldPin, newPin and confirmPin are required"
    );
  }

  // ----------------- Step 4: Verify Old Pin -----------------
  const isMatch = await bcrypt.compare(oldPin, driver.pin);
  if (!isMatch) {
    throw new ApiError(statusCode.BAD_REQUEST, "Old pin is incorrect");
  }

  // ----------------- Step 5: Validate New Pin -----------------
  if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "New pin must be a 4-digit number"
    );
  }

  if (newPin !== confirmPin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "New pin and confirm pin do not match"
    );
  }

  if (oldPin === newPin) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "New pin cannot be same as old pin"
    );
  }

  // ----------------- Step 6: Hash and Save New Pin -----------------
  const salt = await bcrypt.genSalt(10);
  const hashedPin = await bcrypt.hash(newPin, salt);

  driver.pin = hashedPin;
  await driver.save();

  // ----------------- Step 7: Response -----------------
  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        driverId: driver.driverId,
        isPinExist: driver.isPinExist,
      },
      "Pin updated successfully"
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

  if (!driver.isPinExist || !driver.pin) {
    throw new ApiError(statusCode.BAD_REQUEST, "Pin not set for this driver");
  }

  const { pin } = req.body;
  if (!pin) {
    throw new ApiError(statusCode.BAD_REQUEST, "Pin is required");
  }

  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Pin must be a 4-digit number");
  }

  const isMatch = await bcrypt.compare(pin, driver.pin);
  if (!isMatch) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid pin");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { driverId: driver.driverId },
        "Pin verified successfully"
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
};

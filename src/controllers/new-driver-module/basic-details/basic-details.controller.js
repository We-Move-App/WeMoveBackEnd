const statusCode = require("../../../utils/constants/statusCode");
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
  const documents = await DriverDocDetails.find({ driverId }).lean();

  if (!basicDetails) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  return res.status(statusCode.OK).json({
    success: true,
    message: "Driver profile fetched successfully",
    data: {
      basicDetails,
      bankDetails: bankDetails || null,
      vehicleDetails: vehicleDetails || null,
      documents: documents.length ? documents : null,
    },
  });
});

module.exports = {
  addDriverBasicDetails,
  getDriverBasicDetails,
  getDriverProfileDetails,
};

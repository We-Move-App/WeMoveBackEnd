const vehicleImages = require("../../../models/new-driver-module/vehicle-details/vehicle-images.model.json");
const statusCode = require("../../../utils/constants/statusCode");
const {
  decodeAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const ApiResponse = require("../../../utils/response/ApiResponse");
const DriverBasicDetails = require("../../../models/new-driver-module/basic-details/basic-details.model");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  addVehicleDetailsValidation,
} = require("../validations/vehicle-details.validations");
const ApiError = require("../../../utils/response/ApiError");
const VehicleDetail = require("../../../models/new-driver-module/vehicle-details/vehicle-details.model");
const DriverDocDetails = require("../../../models/new-driver-module/documents/driver-documents.model");
const {
  getVehicleDetailsWithDocs,
} = require("../aggregations/vehicle-details.aggregations");
const { DriverDocEnum } = require("../../../utils/constants/ENUM");

const validateDriver = async (authHeader) => {
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

  const driver = await DriverBasicDetails.exists({ driverId });
  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  return driver;
};

const getVehicleImages = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;

  const driver = await validateDriver(authHeader);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        vehicleImages,
        "Vehicle static images fetched"
      )
    );
});

const addVehicleDetails = catchAsyncError(async (req, res) => {
  const { error, value } = addVehicleDetailsValidation.validate(req.body, {
    abortEarly: false,
  });
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

  const vehicleUpdate = VehicleDetail.updateOne(
    { driverId },
    {
      $set: {
        ...value,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  const existingDocEntry = await DriverDocDetails.findOne({ driverId });
  let updatedDocuments = [];

  if (!existingDocEntry) {
    updatedDocuments = value.documents.map((doc) => ({
      ...doc,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await Promise.all([
      vehicleUpdate,
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
      vehicleUpdate,
      DriverDocDetails.updateOne(
        { driverId },
        { $set: { documents: updatedDocuments, updatedAt: new Date() } }
      ),
    ]);
  }

  const aggregatedData = await getVehicleDetailsWithDocs(driverId, [
    DriverDocEnum.INSURANCE,
    DriverDocEnum.REGISTRATION,
    DriverDocEnum.VEHICLEPHOTO,
  ]);

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        aggregatedData,
        "Vehicle details added successfully"
      )
    );
});

const getDriverVehicleDetails = catchAsyncError(async (req, res) => {
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

  const aggregatedData = await getVehicleDetailsWithDocs(driverId, [
    DriverDocEnum.INSURANCE,
    DriverDocEnum.REGISTRATION,
    DriverDocEnum.VEHICLEPHOTO,
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

module.exports = {
  getVehicleImages,
  addVehicleDetails,
  getDriverVehicleDetails,
};

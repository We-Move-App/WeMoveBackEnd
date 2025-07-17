const DriverBankDetail = require("../../../models/new-driver-module/bank-details/bank-details.model");
const DriverDocDetails = require("../../../models/new-driver-module/documents/driver-documents.model");
const DriverBasicDetails = require("../../../models/new-driver-module/basic-details/basic-details.model");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  addBankDetailsValidation,
} = require("../validations/bank-details.validation");
const {
  DriverDocEnum,
  DriverDocStatusEnum,
} = require("../../../utils/constants/ENUM");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const statusCode = require("../../../utils/constants/statusCode");
const {
  decodeAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const {
  getDriverBankWithPassbook,
} = require("../aggregations/bank-details.aggregations");

const addDriverBankDetails = catchAsyncError(async (req, res) => {
  const { error, value } = addBankDetailsValidation.validate(req.body, {
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

  const driverExists = await DriverBasicDetails.exists({ driverId });
  if (!driverExists) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  const bankUpdate = DriverBankDetail.updateOne(
    { driverId },
    {
      $set: {
        accountNumber: value.accountNumber,
        holderName: value.holderName,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  const existingDocEntry = await DriverDocDetails.findOne({ driverId });
  const newDoc = {
    ...value.document,
    documentType: DriverDocEnum.PASSBOOK,
    status: DriverDocStatusEnum.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (!existingDocEntry) {
    await Promise.all([
      bankUpdate,
      DriverDocDetails.create({ driverId, documents: [newDoc] }),
    ]);
  } else {
    const alreadyExists = existingDocEntry.documents.some(
      (doc) => doc.documentType === DriverDocEnum.PASSBOOK
    );

    if (!alreadyExists) {
      existingDocEntry.documents.push(newDoc);
      existingDocEntry.updatedAt = new Date();
      await Promise.all([bankUpdate, existingDocEntry.save()]);
    } else {
      await bankUpdate;
    }
  }

  const aggregatedData = await getDriverBankWithPassbook(driverId);

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        aggregatedData,
        "Bank details added successfully"
      )
    );
});

const getDriverBankDetails = catchAsyncError(async (req, res) => {
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

  const aggregatedData = await getDriverBankWithPassbook(driverId);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        aggregatedData,
        "Driver bank details fetched successfully"
      )
    );
});

module.exports = { addDriverBankDetails, getDriverBankDetails };

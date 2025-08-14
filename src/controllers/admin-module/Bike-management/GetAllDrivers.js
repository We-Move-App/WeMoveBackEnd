const DriverBankDetail = require("../../../models/new-driver-module/bank-details/bank-details.model");
const DriverDocDetails = require("../../../models/new-driver-module/documents/driver-documents.model");
const DriverBasicDetails = require("../../../models/new-driver-module/basic-details/basic-details.model");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  addBankDetailsValidation,
} = require("../../new-driver-module/validations/bank-details.validation");
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

  // Fetch only needed fields
  const basicDetails = await DriverBasicDetails.findOne(
    { driverId },
    { fullName: 1, phoneNumber: 1, email: 1, status: 1, _id: 0 }
  ).lean();

  const vehicleDetails = await VehicleDetails.findOne(
    { driverId },
    { vehicleType: 1, registrationNumber: 1, _id: 0 }
  ).lean();

  if (!basicDetails) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  const response = {
    success: true,
    message: "Driver details fetched successfully",
    data: {
      name: basicDetails.fullName,
      mobile: basicDetails.phoneNumber,
      email: basicDetails.email,
      vehicleType: vehicleDetails?.vehicleType || null,
      registrationNumber: vehicleDetails?.registrationNumber || null,
      status: basicDetails.status,
    },
  };

  return res.status(statusCode.OK).json(response);
});
module.exports
    getDriverProfileDetails 



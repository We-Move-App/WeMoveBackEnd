const DriverLocation = require("../../../models/new-driver-module/location/driver-location.model");
const { LocationStatusEnum } = require("../../../utils/constants/ENUM");
const statusCode = require("../../../utils/constants/statusCode");
const { decodeAccessToken } = require("../../../utils/jwtToken/customTokenService");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");

const updateDriverStatus = catchAsyncError(async (req, res) => {
  const { status, coordinates } = req.body;

  if (!Object.values(LocationStatusEnum).includes(status)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid status");
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

  const update = {
    status,
  };

  if (Array.isArray(coordinates) && coordinates.length === 2) {
    update.location = {
      type: "Point",
      coordinates,
    };
  }

  const driverLocation = await DriverLocation.findOneAndUpdate(
    { driverId },
    { $set: update },
    { upsert: true, new: true }
  );

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        driverLocation,
        `Driver is now ${status}`
      )
    );
});

module.exports = updateDriverStatus;

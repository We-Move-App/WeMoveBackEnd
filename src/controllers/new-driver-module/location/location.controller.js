const DriverLocation = require("../../../models/new-driver-module/location/driver-location.model");
const { LocationStatusEnum } = require("../../../utils/constants/ENUM");
const statusCode = require("../../../utils/constants/statusCode");
const {
  decodeAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const {
  getAutocomplete,
  getDirections,
  getAddressFromCoordinates,
} = require("../../../utils/map/getDistanceAndDuration");
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
      new ApiResponse(statusCode.OK, driverLocation, `Driver is now ${status}`)
    );
});

const getPlaceAutocomplete = catchAsyncError(async (req, res) => {
  const { input, lat, lng } = req.query;

  if (!input || input.trim() === "") {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Input is required for autocomplete"
    );
  }

  try {
    const suggestions = await getAutocomplete(input, lat, lng);

    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(
          statusCode.OK,
          suggestions,
          `Places fetched successfully`
        )
      );
  } catch (err) {
    console.error("Autocomplete Controller Error:", err.message);
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      "Failed to fetch autocomplete suggestions"
    );
  }
});

const getFromCoordinates = catchAsyncError(async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Latitude and longitude are required"
    );
  }

  try {
    const address = await getAddressFromCoordinates(lat, lng);

    if (!address) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        "No address found for given coordinates"
      );
    }

    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(statusCode.OK, address, `Address fetched successfully`)
      );
  } catch (err) {
    console.error("Reverse Geocode Error:", err.message);
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      "Failed to fetch address"
    );
  }
});

const getDirection = catchAsyncError(async (req, res) => {
  const { origin, destination } = req.query;

  if (!origin || !destination) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Both origin and destination are required"
    );
  }

  const directions = await getDirections(origin, destination);

  res.status(statusCode.OK).json({
    success: true,
    message: "Directions fetched successfully",
    data: directions,
  });
});

module.exports = {
  updateDriverStatus,
  getPlaceAutocomplete,
  getFromCoordinates,
  getDirection,
};

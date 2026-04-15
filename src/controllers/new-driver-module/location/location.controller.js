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
  getPlaceDetails,
} = require("../../../utils/map/get-distance-and-duration");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const { translateLn } = require("../../../utils/services/translator.service");

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
    const [lat, lng] = coordinates; // frontend sends lat, lng
    update.location = {
      type: "Point",
      coordinates: [lat, lng], // store as lng, lat
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
  const ln = req.get("ln") || "en";

  if (!input || input.trim() === "") {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "INPUT_REQUIRED_FOR_AUTOCOMPLETE")
    );
  }

  try {
    const suggestions = await getAutocomplete(input, lat, lng);

    if (!suggestions.places || suggestions.places.length === 0) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: translateLn(ln, "NO_SERVICES_AVAILABLE"),
        errors: [],
        data: null,
      });
    }

    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(
          statusCode.OK,
          { places: suggestions.places },
          suggestions.message
        )
      );
  } catch (err) {
    console.error("Autocomplete Controller Error:", err.message);
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      translateLn(ln, "FAILED_TO_FETCH_AUTOCOMPLETE_SUGGESTIONS")
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
        new ApiResponse(
          statusCode.OK,
          address.address,
          `Address fetched successfully`
        )
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
  const ln = req.get("ln") || "en";

  if (!origin || !destination) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ORIGIN_AND_DESTINATION_REQUIRED")
    );
  }

  const directions = await getDirections(origin, destination);

  if (directions.success === false) {
    return res.status(404).json({
      success: false,
      statusCode: 404,
      message: translateLn(ln, "NO_SERVICES_AVAILABLE"),
      errors: [],
      data: null,
    });
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { directions: directions },
        translateLn(ln, "ADDRESS_FETCHED_SUCCESSFULLY")
      )
    );
});

const getPlaceDetail = catchAsyncError(async (req, res) => {
  const { place_id } = req.query;

  if (!place_id) {
    throw new ApiError(statusCode.BAD_REQUEST, "Place ID is required.");
  }

  const placeDetails = await getPlaceDetails(place_id);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { placeDetails },
        "Place details fetched successfully"
      )
    );
});

module.exports = {
  updateDriverStatus,
  getPlaceAutocomplete,
  getFromCoordinates,
  getDirection,
  getPlaceDetail,
};

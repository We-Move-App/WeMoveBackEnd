const statusCode = require("../../utils/constants/statusCode");
const {getDistanceAndDuration} = require("../../utils/map/getDistanceAndDuration");
const ApiError = require("../../utils/response/ApiError");
const ApiResponse = require("../../utils/response/ApiResponse");
const catchAsyncError = require("../../utils/response/catchAsyncError");
const vehicleConfig = require("../../utils/config/vehicleConfig.json");

function calculateFare(type, distanceInKm, durationInMin) {
  const config = vehicleConfig[type];
  if (!config) {
    throw new Error(`Invalid vehicle type: ${type}`);
  }

  const fare = Math.round(
    config.baseFare +
      distanceInKm * config.perKm +
      durationInMin * config.perMin
  );

  return {
    id: config.id,
    text: config.text,
    logo: config.logo,
    fare,
    estimatedArrivalInMin: 5,
  };
}

const estimateRide = catchAsyncError(async (req, res) => {
  const { pickupLocation, dropLocation } = req.body;
  const vehicleType = req.query.vehicleType?.toLowerCase();

  if (!vehicleType || !["bike", "taxi"].includes(vehicleType)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid or missing vehicleType. Must be 'bike' or 'taxi'`
    );
  }

  if (
    !pickupLocation?.lat ||
    !pickupLocation?.lng ||
    !dropLocation?.lat ||
    !dropLocation?.lng
  ) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Pickup and drop coordinates are required"
    );
  }

  const pickup = { lat: pickupLocation.lat, lng: pickupLocation.lng };
  const drop = { lat: dropLocation.lat, lng: dropLocation.lng };

  let metrics;
  if (vehicleType === "bike") {
    try {
      metrics = await getDistanceAndDuration(pickup, drop, "bicycling");
    } catch (err) {
      console.warn("Bicycling mode failed, falling back to driving.");
      metrics = await getDistanceAndDuration(pickup, drop, "driving");
    }
  } else {
    metrics = await getDistanceAndDuration(pickup, drop, "driving");
  }

  const estimate = calculateFare(
    vehicleType.toUpperCase(),
    metrics.distanceInKm,
    metrics.durationInMin
  );

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        ...estimate,
        distanceInKm: metrics.distanceInKm,
        durationInMin: metrics.durationInMin,
      },
      `${vehicleType} ride estimated successfully`
    )
  );
});

module.exports = {
  estimateRide,
};

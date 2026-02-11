const DriverLocation = require("../../../models/new-driver-module/location/driver-location.model");
const DriverBasicDetails = require("../../../models/new-driver-module/basic-details/basic-details.model");
const InactiveDriver = require("../../../models/new-driver-module/basic-details/inactive-drivers.model");
const { LocationStatusEnum } = require("../../../utils/constants/ENUM");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const statusCode = require("../../../utils/constants/statusCode");


const getShiftedCoordinates = (lat, lng) => {
  const offset = 0.0009 + Math.random() * 0.0002;
  const shiftedLat = lat + (Math.random() > 0.5 ? offset : -offset);
  const shiftedLng = lng + (Math.random() > 0.5 ? offset : -offset);
  return { lat: shiftedLat, lng: shiftedLng };
};

const getNearbyActiveDrivers = catchAsyncError(async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Latitude and Longitude are required"
    );
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Invalid latitude or longitude format"
    );
  }

  if (latitude < -90 || latitude > 90) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Latitude must be between -90 and 90"
    );
  }

  if (longitude < -180 || longitude > 180) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Longitude must be between -180 and 180"
    );
  }

  const inactiveDrivers = await InactiveDriver.find({}, { driverId: 1 });
  const inactiveDriverIds = inactiveDrivers.map((d) => d.driverId);

  const nearbyLocations = await DriverLocation.find({
    driverId: { $nin: inactiveDriverIds },
    status: LocationStatusEnum.ONLINE,
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        $maxDistance: 1000,
      },
    },
  }).limit(50);

  if (!nearbyLocations.length) {
    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(
          statusCode.OK,
          { count: 0, drivers: [] },
          "No active drivers found"
        )
      );
  }

  const driverIds = nearbyLocations.map((d) => d.driverId);

  const activeProfiles = await DriverBasicDetails.find({
    driverId: { $in: driverIds },
    isActive: true,
  }).select("driverId ratings");

  const profileMap = new Map(activeProfiles.map((p) => [p.driverId, p]));

  const drivers = nearbyLocations
    .map((loc) => {
      const profile = profileMap.get(loc.driverId);
      if (!profile) return null;

      const originalLat = loc.location.coordinates[1];
      const originalLng = loc.location.coordinates[0];

      const shifted = getShiftedCoordinates(originalLat, originalLng);

      return {
        driverId: loc.driverId,
        rating: profile.ratings,
        location: shifted,
      };
    })
    .filter(Boolean);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { count: drivers.length, drivers },
        "Nearby active drivers fetched successfully"
      )
    );
});

module.exports = { getNearbyActiveDrivers };

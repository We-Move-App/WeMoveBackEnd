const statusCode = require("../../utils/constants/statusCode");
const {getDistanceAndDuration} = require("../../utils/map/get-distance-and-duration");
const ApiError = require("../../utils/response/ApiError");
const ApiResponse = require("../../utils/response/ApiResponse");
const catchAsyncError = require("../../utils/response/catchAsyncError");
const vehicleConfig = require("../../utils/config/vehicleConfig.json");
const RideBookingDetail = require("../../models/new-driver-module/booking-details/booking-details.model");
const { RideBookStatusEnum, EntityCodeEnum } = require("../../utils/constants/ENUM");
const generateCustomId = require("../../utils/customId/generateCustomId");
const findNearbyDrivers = require("../../utils/map/find-near-by-drivers");
const { getOtp } = require("../../utils/otpService/otpService");
const { assignRideToDrivers } = require("../../socket/handlers/rideHandler");
const UserModel = require("../../models/user-module/users/user.model");
const { decodeAccessToken } = require("../../utils/jwtToken/customTokenService");
const { getIO } = require('../../socket/index');

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
  const { pickup, drop } = req.body;
  const vehicleType = req.query.vehicleType?.toLowerCase();

  if (!vehicleType || !["bike", "taxi"].includes(vehicleType)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Invalid or missing vehicleType. Must be 'bike' or 'taxi'"
    );
  }

  if (!pickup?.lat || !pickup?.lng || !drop?.lat || !drop?.lng) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Pickup and drop coordinates are required"
    );
  }

  const pickupCoords = { lat: pickup.lat, lng: pickup.lng };
  const dropCoords = { lat: drop.lat, lng: drop.lng };

  let metrics;
  if (vehicleType === "bike") {
    try {
      metrics = await getDistanceAndDuration(pickupCoords, dropCoords, "bicycling");
    } catch (err) {
      console.warn("Bicycling mode failed, falling back to driving.");
      metrics = await getDistanceAndDuration(pickupCoords, dropCoords, "driving");
    }
  } else {
    metrics = await getDistanceAndDuration(pickupCoords, dropCoords, "driving");
  }

  const estimate = calculateFare(
    vehicleType.toUpperCase(),
    metrics.distanceInKm,
    metrics.durationInMin
  );

  const rideOptions = [
    {
      _id: estimate.id || "001", // fallback if no ID from calculateFare
      vehicleType: vehicleType,
      category: estimate.text || `${vehicleType} Ride`,
      estimatedFare: estimate.fare,
      estimatedDistance: `${metrics.distanceInKm} km`,
      estimatedDuration: `${metrics.durationInMin} min`,
      estimatedPickupTime: `${estimate.estimatedArrivalInMin || 5} min`,
      image: estimate.logo || null,
      description: estimate.description || `${vehicleType} ride estimated`,
    },
  ];

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        rideOptions,
        `${vehicleType} ride estimated successfully`
      )
    );
});

const requestRide = async (req, res, next) => {
  console.log("Api Called");
  
  try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        throw new ApiError(
          statusCode.UNAUTHORIZED,
          "Access token is missing or invalid"
        );
      }
    
      const jwtToken = authHeader.split(" ")[1];
      const decoded = decodeAccessToken(jwtToken);
    
      const userId = decoded?._id;
      const phoneNumber = decoded?.phoneNumber;
    
      if (!userId || !phoneNumber) {
        throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
      }
    
      const userExists = await UserModel.findById(userId);
      if (!userExists) {
        throw new ApiError(statusCode.NOT_FOUND, "User not found");
      }

    const { pickup, drop, vehicle } = req.body;

    if (!pickup?.lat || !pickup?.lng || !pickup?.address) {
      throw new ApiError(statusCode.BAD_REQUEST, "Pickup details required");
    }
    if (!drop?.lat || !drop?.lng || !drop?.address) {
      throw new ApiError(statusCode.BAD_REQUEST, "Drop details required");
    }
    if (!vehicle?._id || !vehicle?.vehicleType) {
      throw new ApiError(statusCode.BAD_REQUEST, "Vehicle details required");
    }

    // Step 1: Create booking
    const bookingId = await generateCustomId(EntityCodeEnum.RIDES, "R");
    const otp = getOtp();

    const newBooking = await RideBookingDetail.create({
      bookingId,
      userId,
      pickupLocation: {
        address: pickup.address,
        location: { type: "Point", coordinates: [pickup.lat, pickup.lng] },
      },
      dropLocation: {
        address: drop.address,
        location: { type: "Point", coordinates: [drop.lat, drop.lng] },
      },
      fare: vehicle.estimatedFare,
      vehicleType: vehicle.vehicleType,
      category: vehicle.category,
      rideStatus: RideBookStatusEnum.REQUESTED,
      expectedOtp: otp,
      distanceInKm: parseFloat(vehicle.estimatedDistance),
      durationInMin: parseInt(vehicle.estimatedDuration),
      timestamps: { requestedAt: new Date() },
    });

    // Step 2: respond to frontend immediately
    res.status(statusCode.OK).json(
      new ApiResponse(statusCode.OK, { bookingId, otp }, "Ride requested successfully")
    );

    // Step 3: start driver assignment in background
    const pickupCoords = [pickup.lat, pickup.lng];
    const nearbyDrivers = await findNearbyDrivers(pickupCoords, vehicle.vehicleType);

    if (nearbyDrivers.length > 0) {
      assignRideToDrivers(bookingId, nearbyDrivers, newBooking, vehicle, otp);
    } else {
      await RideBookingDetail.findOneAndUpdate(
        { bookingId },
        {
          rideStatus: RideBookStatusEnum.CANCELLED,
          cancelledBy: "SYSTEM",
          reasonToCancel: "No nearby drivers",
          "timestamps.cancelledAt": new Date(),
        }
      );
      const io = getIO();
      io.to(userId).emit("ride:cancelled", { bookingId, reason: "No nearby drivers" });
    }
  } catch (err) {
    next(err);
  }
};

module.exports = {
  estimateRide,
  requestRide
};

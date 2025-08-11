const statusCode = require("../../utils/constants/statusCode");
const {
  getDistanceAndDuration,
} = require("../../utils/map/get-distance-and-duration");
const ApiError = require("../../utils/response/ApiError");
const ApiResponse = require("../../utils/response/ApiResponse");
const catchAsyncError = require("../../utils/response/catchAsyncError");
const vehicleConfig = require("../../utils/config/vehicleConfig.json");
const RideBookingDetail = require("../../models/new-driver-module/booking-details/booking-details.model");
const DriverLocation=require('../../models/new-driver-module/location/driver-location.model')
const {
  RideBookStatusEnum,
  EntityCodeEnum,
  LocationStatusEnum,
} = require("../../utils/constants/ENUM");
const generateCustomId = require("../../utils/customId/generateCustomId");
const findNearbyDrivers = require("../../utils/map/find-near-by-drivers");
const { getOtp } = require("../../utils/otpService/otpService");
const { assignRideToDrivers } = require("../../socket/handlers/rideHandler");
const UserModel = require("../../models/user-module/users/user.model");
const {
  decodeAccessToken,
} = require("../../utils/jwtToken/customTokenService");
const { getIO } = require("../../socket/index");

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
      metrics = await getDistanceAndDuration(
        pickupCoords,
        dropCoords,
        "bicycling"
      );
    } catch (err) {
      console.warn("Bicycling mode failed, falling back to driving.");
      metrics = await getDistanceAndDuration(
        pickupCoords,
        dropCoords,
        "driving"
      );
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
    // ----------------- Step 1: Token Validation -----------------
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

    // ----------------- Step 2: User Exists Check -----------------
    const userExists = await UserModel.findById(userId);
    if (!userExists) {
      throw new ApiError(statusCode.NOT_FOUND, "User not found");
    }

    // ----------------- Step 3: Request Body Validation -----------------
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

    // ----------------- Step 4: Create Booking -----------------
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

    // ----------------- Step 5: Respond Immediately -----------------
    res.status(statusCode.CREATED).json(
      new ApiResponse(
        statusCode.CREATED,
        { _id: bookingId, otp },
        "Ride requested successfully"
      )
    );

    // ----------------- Step 6: Run Background Assignment -----------------
    process.nextTick(async () => {
      try {
        // Step 6.1: Log all online drivers
        const onlineDrivers = await DriverLocation.find({
          status: LocationStatusEnum.ONLINE
        }).select("_id location");

        console.log(`Total online drivers: ${onlineDrivers.length}`);
        onlineDrivers.forEach((driver) => {
          console.log(
            `Driver ${driver._id} Location:`,
            driver.location?.coordinates || "N/A"
          );
        });

        // Step 6.2: Find available drivers near pickup
        const pickupCoords = [pickup.lat, pickup.lng];
        const nearbyDrivers = await findNearbyDrivers(
          pickupCoords,
          vehicle.vehicleType
        );

        console.log(`Available nearby drivers: ${nearbyDrivers.length}`);
        nearbyDrivers.forEach((driver) => {
          console.log(
            `Available Driver ${driver._id} Location:`,
            driver.location?.coordinates || "N/A"
          );
        });

        // Step 6.3: Assign or cancel
        if (nearbyDrivers.length > 0) {
          const io = getIO();
          assignRideToDrivers(io,bookingId, nearbyDrivers, newBooking, vehicle, otp);
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
          io.to(userId).emit("ride:cancelled", {
            bookingId,
            reason: "No nearby drivers",
          });
        }
      } catch (err) {
        console.error("Error in background driver assignment:", err);
      }
    });
  } catch (err) {
    next(err);
  }
};

const cancelRideByUser = catchAsyncError(async (req, res) => {
  const { bookingId } = req.params;
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

  // 1. Find the booking
  const booking = await RideBookingDetail.findOne({
    bookingId,
    userId,
    rideStatus: {
      $in: [
        RideBookStatusEnum.REQUESTED,
        RideBookStatusEnum.ACCEPTED,
        RideBookStatusEnum.ARRIVED,
      ],
    },
  });

  if (!booking) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "Active ride not found or already completed/cancelled"
    );
  }

  // 2. Update booking status
  const updatedBooking = await RideBookingDetail.findOneAndUpdate(
    { bookingId },
    {
      rideStatus: RideBookStatusEnum.CANCELLED,
      cancelledBy: "USER",
      reasonToCancel: "Cancelled by user",
      "timestamps.cancelledAt": new Date(),
    },
    { new: true }
  );

  // 3. Notify driver if ride was accepted
  if (booking.driverId) {
    const io = getIO();
    io.to(booking.driverId).emit("ride:cancelled", {
      bookingId,
      reason: "Cancelled by user",
    });
  }

  // 4. Respond to user
  res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { bookingId },
        "Ride cancelled successfully"
      )
    );
});

module.exports = {
  estimateRide,
  requestRide,
  cancelRideByUser,
};

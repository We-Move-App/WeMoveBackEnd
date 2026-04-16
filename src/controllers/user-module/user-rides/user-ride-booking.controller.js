const DriverModel = require("../../../models/driver-module/drivers/drivers.model");
const RidesReview = require("../../../models/global-module/ride-reviews/ride-reviews.model");
const UserRecentSearchModel = require("../../../models/user-module/user-recent-search/user-recent-search.model");
const RideModel = require("../../../models/user-module/user-rides/user-ride.model");
// const { getIo } = require("../../../socket/socketHandler");
const statusCode = require("../../../utils/constants/statusCode");
const {
  formatDistanceTime,
} = require("../../../utils/reqFunctions/reqFunction");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  getAddressCoordinate,
  getDistanceTime,
} = require("../../../utils/services/maps.services");
const {
  calculateFareForVehicle,
} = require("../../../utils/services/ride.services");
const {
  createNotification,
} = require("../../global-notification-module/global-notification.controller");

const generateOtp = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// ===============|| GET VEHICLE FARE FOR RIDE ||==========================
const getVehicleFaresForRide = catchAsyncError(async (req, res, next) => {
  const { pickup, drop, vehicle } = req.query;

  if (!pickup || !drop || !vehicle) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please provide required details"
    );
  }

  // Fetch coordinates
  const pickupCoordinates = await getAddressCoordinate(pickup);
  const dropCoordinates = await getAddressCoordinate(drop);

  if (!pickupCoordinates || !dropCoordinates) {
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      "Unable to fetch location coordinates"
    );
  }

  // Check if the same search already exists
  let recentSearch = await UserRecentSearchModel.findOne({
    user: req.user._id,
    category: "vehicle",
    // "searchDetails.vehicle.pickup.address": pickup,
    "searchDetails.vehicle.drop.address": drop,
  });

  if (recentSearch) {
    recentSearch.searchDetails.vehicle.pickup = {
      address: pickup,
      latitude: pickupCoordinates.ltd,
      longitude: pickupCoordinates.lng,
    };
    recentSearch.searchTime = new Date();
  } else {
    // Create a new entry if not found
    recentSearch = new UserRecentSearchModel({
      user: req.user._id,
      category: "vehicle",
      searchDetails: {
        vehicle: {
          pickup: {
            address: pickup,
            latitude: pickupCoordinates.ltd,
            longitude: pickupCoordinates.lng,
          },
          drop: {
            address: drop,
            latitude: dropCoordinates.ltd,
            longitude: dropCoordinates.lng,
          },
        },
      },
    });
  }

  await recentSearch.save();

  // Get distance & fare details
  const getDistanceAndTime = await getDistanceTime(pickup, drop);
  if (!getDistanceAndTime) {
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      "Unable to fetch distance and time"
    );
  }

  const result = formatDistanceTime(getDistanceAndTime);
  if (!result) {
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      "Unable to format distance and time"
    );
  }

  const { distance, duration } = result;
  const fareDetails = await calculateFareForVehicle(distance, vehicle);

  // Response
  const data = {
    fares: fareDetails,
    totalDistance: `${distance} km`,
    estimatedTime: `${duration}`,
    pickupCoordinates,
    dropCoordinates,
  };

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, data, "Fare Details"));
});

// ===============|| CREATE RIDE ||==========================
const createRide = catchAsyncError(async (req, res, next) => {
  const { vehicle, vehicleType, pickup, drop, fare } = req.body;

  if (!pickup || !drop || !vehicle || !vehicleType) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please provide required details"
    );
  }

  const pickupCoordinates = await getAddressCoordinate(pickup);
  if (!pickupCoordinates) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid pickup address");
  }
  const dropCoordinates = await getAddressCoordinate(drop);
  if (!dropCoordinates) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid drop address");
  }

  const distanceTime = await getDistanceTime(pickup, drop);

  const fareDetails = await calculateFareForVehicle(
    distanceTime.distance.value / 1000,
    vehicle
  );

  const result = formatDistanceTime(distanceTime);
  if (!result) {
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      "Unable to format distance and time"
    );
  }

  const { distance, duration } = result;

  const selectedFare = fareDetails?.find(
    (item) => item.vehicle === vehicleType
  );
  if (!selectedFare) {
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      "Invalid vehicle type"
    );
  }

  // Save the new ride
  const newRide = new RideModel({
    vehicle,
    vehicleType,
    pickup: {
      address: pickup,
      latitude: pickupCoordinates.ltd,
      longitude: pickupCoordinates.lng,
    },
    drop: {
      address: drop,
      latitude: dropCoordinates.ltd,
      longitude: dropCoordinates.lng,
    },
    totalDistance: distance,
    totalTime: duration,
    fare: parseFloat(selectedFare?.fare?.finalAmount),
    detailedFare: selectedFare?.fare,
    user: req.user._id,
    status: "CREATED",
    paymentStatus: "PENDING",
    otp: generateOtp(),
  });
  if (!newRide) {
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      "Failed to create ride"
    );
  }

  // Save to the database
  await newRide.save();

  try {
    await createNotification(
      req.user._id,
      {
        en: "Ride Requested",
        fr: "Course demandée",
      },
      {
        en: `Your ride from ${pickup} to ${drop} has been created`,
        fr: `Votre course de ${pickup} à ${drop} a été créée`,
      }
    );
  } catch (err) {
    console.error("Notification error:", err.message);
  }

  const io = getIo();
  io.emit("searchCaptain", newRide._id);

  res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        newRide,
        `Your ride created successfully`
      )
    );
});

// ===============|| GET ALL RIDES ||==========================
const getAllRides = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  console.log("In get all rides");
  const rides = await RideModel.find({ user: _id });

  // const filteredRidesByStatusCancelled = rides.filter((ride)=> ride.status !== 'CANCELLED');

  if (!rides || rides.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "No ride found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, rides, "Rides retrieved successfully")
    );
});

// ===============|| GET RIDE BY ID ||==========================
const getRideDetailsById = catchAsyncError(async (req, res, next) => {
  // console.log(req.query, req.params)
  const { _id } = req.user;
  const { id: rideId } = req.params;
  // const query = { _id: rideId, user: _id };
  // const query = { _id: rideId };

  // const ride = await RideModel.findOne(query);
  const ride = await RideModel.findById(rideId);

  if (!ride) {
    throw new ApiError(statusCode.NOT_FOUND, "No ride found");
  }

  if (ride.status === "CANCELLED") {
    throw new ApiError(statusCode.NOT_FOUND, "The ride has been cancelled.");
  }

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, ride, "Rides retrieved successfully"));
});

// ===============|| CANCEL RIDE BY ID ||==========================
const cancelRideByRideId = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const { id: rideId } = req.params;
  const { cancelReason, cancelFeedback } = req.body;

  if (!cancelReason || !cancelFeedback) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please provide required details"
    );
  }

  const ride = await RideModel.findById(rideId);
  if (!ride) {
    throw new ApiError(statusCode.NOT_FOUND, "No ride found");
  }

  if (ride && ride.status === "CANCELLED") {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please provide required details"
    );
  }

  // Update the ride with cancellation details
  ride.status = "CANCELLED";
  ride.canceledBy = "USER";
  ride.cancelReason = cancelReason;
  ride.cancelFeedback = cancelFeedback;

  await ride.save();

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, ride, "Ride cancelled successfully"));
});

// {
//   vehicle: {
//     type: String,
//     enum: ["bike", "taxi"],
//     required: true,
//   },
//   vehicleType: {
//     type: String,
//     required: true,
//     validate: {
//       validator: function (value) {
//         return validateSubType(value, this.vehicle);
//       },
//       message: "Invalid sub-type for the selected vehicle type",
//     },
//   },
//   pickup: {
//     address: { type: String, required: true },
//     latitude: { type: Number, required: true },
//     longitude: { type: Number, required: true },
//   },
//   drop: {
//     address: { type: String, required: true },
//     latitude: { type: Number, required: true },
//     longitude: { type: Number, required: true },
//   },
//   fare: {
//     type: Number,
//     required: true,
//   },
//   detailedFare: {
//     type: fareSchema
//   },
//   user: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     required: true,
//   },
//   driver: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Driver",
//   },
//   totalDistance :{type:String},
//   totalTime:{type:String},

//   status: {
//     type: String,
//     enum: [
//       "CREATED",
//       "SEARCHING_FOR_CAPTAIN",
//       "START",
//       "ONGOING",
//       "ARRIVED",
//       "COMPLETED",
//       "CANCELLED",
//     ],
//     default: "CREATED",
//   },
//   otp: {
//     type: String,
//     default: null,
//   },
//   cancelReason: {
//     type: String,
//     default: null,
//   },
//   cancelFeedback: {
//     type: String,
//     default: null,
//   },
//   canceledBy: {
//     type: String,
//     enum: ["USER", "DRIVER"],
//     default: null,
//   },
//   paymentStatus: {
//     type: String,
//     enum: [
//       "PENDING",
//       "PAID",
//       "FAILED",
//       "REFUND_REQUESTED",
//       "REFUND_PROCESSING",
//       "REFUNDED",
//     ],
//     default: "PENDING",
//   },
//   paymentId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "RidePayment",
//   },
//   driverFeedback: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "DriverReview",
//   },
//   refundAmount: {
//     type: Number,
//   },
//   refundDate: {
//     type: Date,
//   },
//   transactionId: {
//     type: Schema.Types.ObjectId,
//     ref: "Transactions",
//   },
// },

// ===============|| ADD RIDE REVIEW ||========================
const addRidesReview = catchAsyncError(async (req, res, next) => {
  const { driverId, rideId, rating, comment } = req.body;
  const { _id } = req.user;

  if (!driverId || !rideId || !rating || !comment) {
    throw new ApiError(statusCode.BAD_REQUEST, "Missing required fields");
  }
  if (rating < 1 || rating > 5) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Rating must be between 1 and 5"
    );
  }

  const driver = await DriverModel.findById(driverId);
  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }
  const ride = await RideModel.findOne({ _id: rideId, status: "COMPLETED" });
  if (!ride) {
    throw new ApiError(statusCode.NOT_FOUND, "Ride not found or not completed");
  }

  const existingReview = await RidesReview.findOne({
    driverId: driverId,
    rideId: rideId,
    userId: _id,
  });
  if (existingReview) {
    throw new ApiError(statusCode.CONFLICT, "Review already exists");
  }

  const review = new RidesReview({
    userId: _id,
    driverId,
    rideId,
    rating,
    comment,
  });

  if (!review) {
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      "Failed to add review"
    );
  }
  ride.driverFeedback = review._id;

  await Promise.all([ride.save(), review.save()]);

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        message: "Driver review added successfully",
        review,
      },
      "Review added successfully"
    )
  );
});

const userActiveRide = catchAsyncError(async (req, res, next) => {
  const activeRide = await RideModel.findOne({
    user: req.user._id,
    status: {
      $in: [
        "CREATED",
        "REQUESTED",
        "SEARCHING_FOR_CAPTAIN",
        "START",
        "ONGOING",
        "ARRIVED",
        "ACCEPTED",
      ],
    },
  }).populate("user", "fullName phoneNumber");

  if (!activeRide) {
    throw new ApiError(statusCode.NOT_FOUND, "Ride not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, activeRide, "Ride found successfully")
    );
});

module.exports = {
  createRide,
  getAllRides,
  getRideDetailsById,
  getVehicleFaresForRide,
  addRidesReview,
  cancelRideByRideId,
  userActiveRide,
};

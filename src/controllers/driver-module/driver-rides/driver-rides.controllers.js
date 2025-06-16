const RideModel = require("../../../models/user-module/user-rides/user-ride.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");

// ===============|| GET ALL RIDES ||==========================
const getAllRides = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  console.log("In get all rides");
  const rides = await RideModel.find({ driver: _id });

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

const getRideDetailsById = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const { id: rideId } = req.params;

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

const driverActiveRide = catchAsyncError(async (req, res, next) => {
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
  getAllRides,
  getRideDetailsById,

  driverActiveRide,
};

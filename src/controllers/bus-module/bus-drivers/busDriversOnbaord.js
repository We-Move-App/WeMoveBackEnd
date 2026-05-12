const BusDriverModel = require("../../../models/bus-module/bus-drivers/bus-drivers.model");
const BusOperatorModel = require("../../../models/bus-module/bus-operator/bus-operator.model");

const {
  busOperatorAuthoritiesFields,
} = require("../../../utils/constants/constants");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const BusBookingModel = require("../../../models/bus-module/bus-bookings/bus-bookings.model");
const BusModel = require("../../../models/bus-module/buses/buses.model");
const BusRouteModel = require("../../../models/bus-module/bus-routes/bus-routes.model");
const mongoose = require("mongoose");
const moment = require("moment");
const BusSeatsLayoutModel = require("../../../models/bus-module/bus-seats-management/buses-seats.model");
const BusActivityLogModel = require("../../../models/bus-module/busActivityonBoardModel/busActivityModel");

// const onboardUserByQR = catchAsyncError(async (req, res, next) => {
//   const { bookingId, phoneNo } = req.body;

//   if (!bookingId || !phoneNo) {
//     return res.status(400).json({
//       success: false,
//       message: "Booking ID and Driver Phone Number are required",
//     });
//   }

//   const driver = await BusDriverModel.findOne({ phoneNumber: phoneNo }).populate("assignedBus");

//   if (!driver || !driver.assignedBus) {
//     return res.status(404).json({
//       success: false,
//       message: "Driver not found or not assigned to any bus",
//     });
//   }

//   const booking = await BusBookingModel.findById(bookingId).populate("busId");

//   if (!booking) {
//     return res.status(404).json({
//       success: false,
//       message: "Booking not found",
//     });
//   }

//   if (booking.busId._id.toString() !== driver.assignedBus._id.toString()) {
//     return res.status(403).json({
//       success: false,
//       message: "This booking does not belong to the driver's assigned bus",
//     });
//   }

//   booking.isUseronboarded = true;
//   await booking.save();

//   return res.status(200).json({
//     success: true,
//     message: "User onboarded successfully",
//     userDetails: {
//       bookingId: booking._id,
//       from: booking.from,
//       to: booking.to,
//       journeyDate: booking.journeyDate,
//       passengers: booking.passengers,
//       seatNumbers: booking.seatNumbers,
//     },
//   });
// });

// const onboardUserByQR = catchAsyncError(async (req, res) => {
//   const driverId = req.user_id;
//   const { bookingId } = req.body;

//   if (!driverId) {
//     throw new ApiError(statusCode.UNAUTHORIZED, "Driver not authenticated");
//   }

//   if (!bookingId) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Booking ID is required");
//   }

//   // Fetch driver and assigned bus
//   const driver = await BusDriverModel.findById(driverId).populate("assignedBus");

//   if (!driver || !driver.assignedBus) {
//     throw new ApiError(statusCode.FORBIDDEN, "Driver is not assigned to any bus");
//   }

//   // Fetch booking
//   const booking = await BusBookingModel.findById(bookingId).populate("bookedBy");

//   if (!booking) {
//     throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
//   }

//   // Allow only 'Booked' status
//   if (booking.status !== "Booked") {
//     throw new ApiError(
//       statusCode.BAD_REQUEST,
//       `Cannot onboard. Current booking status: ${booking.status}`
//     );
//   }

//   // Prevent duplicate onboarding
//   if (booking.isUseronboarded) {
//     throw new ApiError(statusCode.BAD_REQUEST, "User is already onboarded");
//   }

//   // Check bus ID and operator match
//   if (
//     booking.busId.toString() !== driver.assignedBus._id.toString() ||
//     booking.bookedByOperator.toString() !== driver.busOperator.toString()
//   ) {
//     throw new ApiError(
//       statusCode.FORBIDDEN,
//       "Booking does not match driver’s assigned bus or operator"
//     );
//   }

//   // Onboard passenger
//   booking.isUseronboarded = true;
//   await booking.save();

//   // Send only passenger details
//   return res.status(statusCode.OK).json({
//     message: "Passenger onboarded successfully",
//     passengerDetails: booking.passengers,
//   });
// });
const onboardUserByQR = catchAsyncError(async (req, res, next) => {
  const driverId = req.user_id;
  const { bookingId } = req.body;

  const booking = await BusBookingModel.findById(bookingId);
  const driver =
    await BusDriverModel.findById(driverId).populate("assignedBus");

  if (!booking || !driver || !driver.assignedBus) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "Driver or booking not found, or bus not assigned to driver"
    );
  }

  if (String(driver.assignedBus._id) !== String(booking.busId._id)) {
    throw new ApiError(
      statusCode.FORBIDDEN,
      "Driver is not assigned to this bus"
    );
  }

  if (booking.isUseronboarded) {
    throw new ApiError(statusCode.BAD_REQUEST, "User is already onboarded");
  }

  booking.isUseronboarded = true;
  await booking.save();

  await BusActivityLogModel.create({
    action: "onboard_user",
    driver: driverId,
    bus: booking.busId,
    bookingId: booking._id,
    time: new Date(),
  });

  res.status(statusCode.OK).json({
    success: true,
    message: "User onboarded successfully",
    passenger: booking.passengers,
  });
});

const getOnboardedUsersSummary = catchAsyncError(async (req, res, next) => {
  console.log("Fetching onboarded users summary for driver...");
  const driverId = req.user_id;
  console.log("Driver ID:", driverId);

  const driver =
    await BusDriverModel.findById(driverId).populate("assignedBus");

  if (!driver || !driver.assignedBus) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "Driver or assigned bus not found"
    );
  }

  const assignedBusId = driver.assignedBus._id;

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Query onboarded bookings only for this bus
  const onboardedBookings = await BusBookingModel.find({
    busId: assignedBusId,
    isUseronboarded: true,
  })
    .select("passengers journeyDate busId from to seatNumbers")
    .populate("busId", "busRegNumber")
    .skip(skip)
    .limit(limit)
    .sort({ journeyDate: -1 });

  const total = await BusBookingModel.countDocuments({
    busId: assignedBusId,
    isUseronboarded: true,
  });

  const allPassengers = onboardedBookings.flatMap((booking) =>
    booking.passengers.map((passenger) => ({
      name: passenger.name,
      age: passenger.age,
      gender: passenger.gender,
      contactNumber: passenger.contactNumber,
      seatNumber: passenger.seatNumber,
      journeyDate: booking.journeyDate,
      from: booking.from,
      to: booking.to,
      busRegNumber: booking.busId?.busRegNumber || null,
    }))
  );

  return res.status(statusCode.OK).json({
    success: true,
    totalPassengers: total,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    passengers: allPassengers,
  });
});

module.exports = {
  onboardUserByQR,
  getOnboardedUsersSummary,
};

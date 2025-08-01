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
  const { bookingId } = req.params;
 

 
  const booking = await BusBookingModel.findById(bookingId);
  const driver = await BusDriverModel.findById(driverId).populate("assignedBus");
console.log("Booking:", booking);
console.log("Driver:", driver);
console.log("Driver.assignedBus:", driver?.assignedBus);

  if (!booking || !driver || !driver.assignedBus) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver or booking not found, or bus not assigned to driver");
  }

 
  if (String(driver.assignedBus._id) !== String(booking.busId)) {
    throw new ApiError(statusCode.FORBIDDEN, "Driver is not assigned to this bus");
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
    data: booking,
  });
});

const getOnboardedUsersSummary = catchAsyncError(async (req, res) => {
  const { bookingId } = req.query;

  if (!bookingId) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Booking ID is required",
    });
  }

  const booking = await BusBookingModel.findOne({
    _id: bookingId,
    isUseronboarded: true,
  });

  if (!booking) {
    return res.status(404).json({
      success: false,
      statusCode: 404,
      message: "Onboarded booking not found",
    });
  }

  const bus = await BusModel.findById(booking.busId);
  if (!bus) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Bus not found for this booking",
    });
  }

  const driver = await BusDriverModel.findOne({
    assignedBus: bus._id,
  });

  if (!driver) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Assigned driver not found for this bus",
    });
  }

  return res.status(200).json({
    success: true,
    statusCode: 200,
    message: "Onboarded user details fetched successfully",
    data: {
      bookingId: booking._id,
      from: booking.from,
      to: booking.to,
      journeyDate: booking.journeyDate,
      busName: bus.busName || "N/A",
      busRegNumber: bus.busRegNumber || "N/A",
      driver: {
        fullName: driver.fullName,
        phoneNumber: driver.phoneNumber,
      },
      seatNumbers: booking.seatNumbers,
      passengers: booking.passengers,
    },
  });
});

module.exports =
{
onboardUserByQR,
getOnboardedUsersSummary
};

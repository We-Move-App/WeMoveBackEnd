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
const { fetchLn } = require("../../../utils/services/user.services");
const { translateLn } = require("../../../utils/services/translator.service");

const onboardUserByQR = catchAsyncError(async (req, res, next) => {
  const driverId = req.user_id;
  const { bookingId } = req.body;
  const ln = (req.headers["ln"] || "en").toLowerCase();

  const booking = await BusBookingModel.findById(bookingId).populate("busId");
  const driver =
    await BusDriverModel.findById(driverId).populate("assignedBus");

  if (!booking || !driver || !driver.assignedBus) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "DRIVER_OR_BOOKING_NOT_FOUND")
    );
  }

  if (String(driver.assignedBus._id) !== String(booking.busId._id)) {
    throw new ApiError(
      statusCode.FORBIDDEN,
      translateLn(ln, "DRIVER_NOT_ASSIGNED_TO_BUS")
    );
  }

  if (booking.isUseronboarded) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "USER_ALREADY_ONBOARDED")
    );
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
    message: translateLn(ln, "USER_ONBOARDED_SUCCESSFULLY"),
    passenger: booking.passengers,
  });
});

const getOnboardedUsersSummary = catchAsyncError(async (req, res, next) => {
  const driverId = req.user_id;
  const ln = (req.headers["ln"] || "en").toLowerCase();

  const driver =
    await BusDriverModel.findById(driverId).populate("assignedBus");

  if (!driver || !driver.assignedBus) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "DRIVER_ASSIGNED_BUS_NOT_FOUND")
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
    message: translateLn(ln, "ONBOARDED_USERS_FETCHED_SUCCESSFULLY"),
    totalPages: Math.ceil(total / limit),
    passengers: allPassengers,
  });
});

module.exports = {
  onboardUserByQR,
  getOnboardedUsersSummary,
};

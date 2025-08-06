const catchAsyncError = require("../../../utils/response/catchAsyncError");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const BusBookingModel = require("../../../models/bus-module/bus-bookings/bus-bookings.model");
const {
  validateRequestBody,
  normalizeDate,
  checkBusOperatorAuthority,
  isValidFutureDate,
  getDayOfDate,
} = require("../../../utils/reqFunctions/reqFunction");
const Wallet = require("../../../models/wallet-module/wallets.model");
const BusModel = require("../../../models/bus-module/buses/buses.model");
const BusRouteModel = require("../../../models/bus-module/bus-routes/bus-routes.model");
const mongoose = require("mongoose");
const moment = require("moment");
const BusSeatsLayoutModel = require("../../../models/bus-module/bus-seats-management/buses-seats.model");
const {
  busOperatorAuthoritiesFields,
  PaymentStatus,
} = require("../../../utils/constants/constants");
const Transaction = require("../../../models/transaction-module/transaction.model");
const { getFinalPrice } = require("../../../utils/services/prices.services");
const {
  PaymentStatusEnum,
  TransactionTypeEnum,
} = require("../../../utils/constants/ENUM");

const getAllBusBookings = catchAsyncError(async (req, res, next) => {
  const {
    date,
    busId,
    routeId,
    sortBy,
    order,
    limit,
    page,
    startDate,
    endDate,
    pickup,
    drop,
  } = req.query;
  const busOperator = req.user._id;
  // Initialize query object
  const query = {};

  // If busId is provided, filter by it; otherwise, filter by busOperator
  if (busId) {
    query.busId = busId;
  } else {
    // Retrieve all buses for the given operator
    const buses = await BusModel.find({ ownerId: busOperator }).select("_id");
    if (!buses.length) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        "No buses found for this operator"
      );
    }
    query.busId = { $in: buses.map((bus) => bus._id) };
  }

  if (startDate) {
    const selectedStartDate = moment.utc(startDate, "YYYY-MM-DD", true);

    if (!selectedStartDate.isValid()) {
      throw new ApiError(statusCode.BAD_REQUEST, "Invalid date format");
    }

    query.journeyDate = {
      $gte: normalizeDate(selectedStartDate),
      // $lte: normalizeDate(selectedEndDate),
    };
  }
  if (endDate) {
    const selectedEndDate = moment.utc(endDate, "YYYY-MM-DD", true);
    if (!selectedEndDate.isValid()) {
      throw new ApiError(statusCode.BAD_REQUEST, "Invalid date format");
    }

    query.journeyDate = {
      // $gte: normalizeDate(selectedStartDate),
      $lte: normalizeDate(selectedEndDate),
    };
  }
  if (pickup) {
    query.from = { $regex: pickup, $options: "i" };
  }
  if (drop) {
    query.to = { $regex: drop, $options: "i" };
  }

  
  if (routeId) {
    query.routeId = routeId;
  }

  const pageNumber = parseInt(page) || 1;
  const pageSize = parseInt(limit) || 10;
  const skip = (pageNumber - 1) * pageSize;

 
  const sortField = sortBy || "createdAt";
  const sortOrder = order === "desc" ? 1 : -1;

  const bookings = await BusBookingModel.find(query)
    .sort({ [sortField]: sortOrder })
    .skip(skip)
    .limit(pageSize)
    .select(
      "from to seatNumbers paymentStatus journeyDate passengers status createdAt updatedAt email phoneNumber bookedBy bookedByOperator bookingBy"
    )
    .populate("bookedBy", "fullName email phoneNumber")
    .populate("bookedByOperator", "fullName email phoneNumber")
    .populate("busId", "busRegNumber");

  if (!bookings || bookings.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "No bookings found");
  }
  const totalBookings = await BusBookingModel.countDocuments(query);

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        bookings,
        totalBookings,
        totalPages: Math.ceil(totalBookings / pageSize),
        currentPage: pageNumber,
      },
      "Bus bookings retrieved successfully"
    )
  );

});
const getBusBookingDetails = catchAsyncError(async (req, res, next) => {
  const { bookingId } = req.params;
  if (!bookingId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Booking ID is required");
  }
  const booking = await BusBookingModel.findById(bookingId)
    .populate(
      "busId",
      "busName busRegNumber busModelNumber createdAt updatedAt email phoneNumber"
    )
    .populate("bookedBy", "fullName email phoneNumber")
    .populate("routeId", "startLocation endLocation departureTime arrivalTime")
    .populate("bookedBy", "fullName email phoneNumber")
    .populate("bookedByOperator", "fullName email phoneNumber");

  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        booking,
        "Bus booking details retrieved successfully"
      )
    );
});

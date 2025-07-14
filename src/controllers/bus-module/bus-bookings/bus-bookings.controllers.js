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
const BusModel = require("../../../models/bus-module/buses/buses.model");
const BusRouteModel = require("../../../models/bus-module/bus-routes/bus-routes.model");
const mongoose = require("mongoose");
const moment = require("moment");
const BusSeatsLayoutModel = require("../../../models/bus-module/bus-seats-management/buses-seats.model");
const {
  busOperatorAuthoritiesFields,
  PaymentStatus,
} = require("../../../utils/constants/constants");
const { getFinalPrice } = require("../../../utils/services/prices.services");

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

  // Filter by routeId if provided
  if (routeId) {
    query.routeId = routeId;
  }

  // Set default pagination values
  const pageNumber = parseInt(page) || 1;
  const pageSize = parseInt(limit) || 10;
  const skip = (pageNumber - 1) * pageSize;

  // Sorting logic
  const sortField = sortBy || "createdAt";
  const sortOrder = order === "desc" ? 1 : -1;

  // Fetch bookings with pagination and sorting
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

  // Get total count for pagination
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

const createBusBooking = catchAsyncError(async (req, res, next) => {
  const { _id: userId } = req.user;
  const {
    from,
    to,
    busId,
    routeId,
    passengers,
    // seatNumbers,
    noOfPassengers,
    price,
    journeyDate,
    termAndConditions,
  } = req.body;

  const reqField = [
    "from",
    "to",
    "busId",
    "routeId",
    "passengers",
    "price",
    "journeyDate",
    "termAndConditions",
  ];
  validateRequestBody(reqField, req.body);
   console.log("noOfPassengers:", noOfPassengers);
console.log(" passengers.length:", passengers.length);

  // Validate passenger and seat count match
  if (noOfPassengers !== passengers.length) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Passenger count does not match the number of selected seats"
    );

  }

  isValidFutureDate(journeyDate);

  const [findBus, route] = await Promise.all([
    BusModel.findById(busId, "noOfSeats"),
    BusRouteModel.findById(routeId, "_id"),
  ]);

  if (!findBus) throw new ApiError(statusCode.NOT_FOUND, "Bus data not found");
  if (!route) throw new ApiError(statusCode.NOT_FOUND, "Route not found");

  if (!findBus?.noOfSeats || findBus?.noOfSeats === 0)
    throw new ApiError(statusCode.NOT_FOUND, "Please add bus seats first");

  const journeyDateNormalized = normalizeDate(journeyDate);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let seatAvailability = await BusSeatsLayoutModel.findOne({
      busId,
      journeyDate: journeyDateNormalized,
      routeId,
    }).session(session);

    if (!seatAvailability) {
      let busSeats = [];
      for (let i = 0; i < findBus.noOfSeats; i++) {
        busSeats.push({
          seatNumber: `S${i + 1}`,
          isAvailable: true,
          seatType: "regular",
          status: "available",
        });
      }
      seatAvailability = await BusSeatsLayoutModel.create(
        [
          {
            busId,
            seats: busSeats,
            noOfSeats: findBus.noOfSeats,
            journeyDate: journeyDateNormalized,
            bookedSeats: 0,
            availableSeats: findBus.noOfSeats,
            routeId,
          },
        ],
        { session }
      );
      seatAvailability = seatAvailability[0];
    }

    // Get available seats
    const availableSeats = seatAvailability.seats.filter(
      (seat) => seat.isAvailable
    );

    if (availableSeats.length < noOfPassengers) {
      throw new ApiError(
        statusCode.CONFLICT,
        `Not enough available seats, available seats: ${availableSeats.length}`
      );
    }

    // Assign next available seats
    const assignedSeats = availableSeats
      .slice(0, noOfPassengers)
      .map((seat) => seat.seatNumber);

    // Assign seats to passengers
    const assignSeatToPassenger = passengers.map((passenger, index) => ({
      ...passenger,
      seatNumber: assignedSeats[index],
    }));

    // Create a new booking entry
    const newBooking = await BusBookingModel.create(
      [
        {
          busId,
          bookedByOperator: userId,
          routeId,
          passengers: assignSeatToPassenger,
          noOfPassengers,
          price,
          journeyDate: journeyDateNormalized,
          termAndConditions: true,
          paymentStatus: PaymentStatus["PENDING"],
          from,
          to,
          seatNumbers: assignedSeats,
          bookingBy: "busOperator",
        },
      ],
      { session }
    );

    // Update seat statuses
    seatAvailability.seats = seatAvailability.seats.map((seat) => {
      if (assignedSeats.includes(seat.seatNumber)) {
        seat.status = "booked";
        seat.bookingReference = newBooking[0]._id;
        seat.isAvailable = false;
      }
      return seat;
    });

    seatAvailability.availableSeats -= noOfPassengers;
    seatAvailability.bookedSeats += noOfPassengers;
    await seatAvailability.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res
      .status(statusCode.CREATED)
      .json(
        new ApiResponse(
          statusCode.CREATED,
          newBooking[0],
          "Bus booked successfully"
        )
      );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
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

const cancelBooking = catchAsyncError(async (req, res, next) => {
  const { bookingId } = req.params;

  const booking = await BusBookingModel.findById(bookingId).select(
    "paymentStatus status routeId busId journeyDate"
  );

  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }
  if (["Cancelled", "Completed"].includes(booking.status)) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      `Your booking is already ${booking.status}`
    );
  }

  if (["PAID"].includes(booking.paymentStatus)) {
    booking.paymentStatus = "REFUND_REQUESTED";
  }

  const bookedSeat = await BusSeatsLayoutModel.findOne({
    busId: booking.busId,
    journeyDate: booking.journeyDate,
    routeId: booking.routeId,
  });
  if (!bookedSeat) {
    throw new ApiError(statusCode.NOT_FOUND, "Booked seat layout not found");
  }

  // Clear the seat(s) that belong to this booking
  bookedSeat.seats = bookedSeat.seats.map((seat) => {
    if (seat.bookingReference?.toString() === bookingId.toString()) {
      return {
        ...seat,
        isAvailable: true,
        bookingReference: null,
        status: "available",
      };
    }
    return seat;
  });

  booking.status = "Cancelled";
  booking.cancelledBy = "busOperator";
  const totalSeats = bookedSeat.seats.length;
  const bookedSeatsCount = bookedSeat.seats.filter(
    (seat) => !seat.isAvailable
  ).length;

  bookedSeat.bookedSeats = bookedSeatsCount;
  bookedSeat.availableSeats = totalSeats - bookedSeatsCount;

  await Promise.all([booking.save(), bookedSeat.save()]);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, booking, "Booking cancelled successfully")
    );
});
const updateBooking = catchAsyncError(async (req, res, next) => {
  const { bookingId } = req.params;
  const reqField = [
    "from",
    "to",
    "busId",
    "routeId",
    "passengers",
    "price",
    "journeyDate",
  ];

  const booking = await BusBookingModel.findById(bookingId);

  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }
});

// =================|| SEARCHES BUS BY USERS||==================
const searchBuses = catchAsyncError(async (req, res, next) => {
  const { from, to, dateOfJourney } = req.query;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;

  const reqField = ["from", "to", "dateOfJourney"];
  validateRequestBody(reqField, req.query);

  const getDay = getDayOfDate(dateOfJourney);

  const query = {
    $and: [
      {
        $or: [
          { from: { $regex: from, $options: "i" } },
          { "pickups.name": { $regex: from, $options: "i" } },
        ],
      },
      {
        $or: [
          { to: { $regex: to, $options: "i" } },
          { "drops.name": { $regex: to, $options: "i" } },
        ],
      },
      {
        runningDays: {
          $in: [getDay],
        },
      },
      {
        status: "active",
      },
      {
        createdBy: req.user._id,
      },
    ],
  };

  const findRoutes = await BusRouteModel.find(query)
    .sort({ createdAt: -1 })
    .skip(startIndex)
    .limit(limit)
    .populate("seats", "bookedSeats availableSeats noOfSeats");

  if (!findRoutes.length) {
    return next(
      new ApiError(statusCode.NOT_FOUND, "No matching bus routes found")
    );
  }

  // ✅ Use Promise.all() to resolve all async operations before proceeding
  const updatedRoutes = await Promise.all(
    findRoutes.map(async (route) => {
      const pricePerSeat = await getFinalPrice(
        "bus",
        route.pricePerSeat,
        new Date()
      );
      return {
        ...route.toObject(),
        pricePerSeat,
      };
    })
  );

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        updatedRoutes,
        "Bus routes found successfully"
      )
    );
});

module.exports = {
  
  getAllBusBookings,
  createBusBooking,
  getBusBookingDetails,
  cancelBooking,
  updateBooking,
  searchBuses,
};

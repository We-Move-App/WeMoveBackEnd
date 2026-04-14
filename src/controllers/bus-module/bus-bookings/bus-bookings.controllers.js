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
  EntityCodeEnum,
} = require("../../../utils/constants/ENUM");
const generateCustomId = require("../../../utils/customId/generateCustomId");

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

  console.log("Query Parameters:");
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
  // Global search by bookingId
  if (req.query.search && req.query.search.trim() !== "") {
    query.bookingId = { $regex: req.query.search, $options: "i" };
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
      "from to bookingId  seatNumbers paymentStatus journeyDate passengers status createdAt updatedAt email phoneNumber bookedBy bookedByOperator bookingBy"
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

const createBusBooking = catchAsyncError(async (req, res, next) => {
  console.log(req.user);
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

  // Validate passenger and seat count match

  if (!Array.isArray(passengers) || passengers.length === 0) {
    throw new ApiError(400, "Passengers must be a non-empty array");
  }
  if (noOfPassengers !== passengers.length) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Passenger count does not match the number of selected seats"
    );
  }

  if (!price || price <= 0) {
    throw new ApiError(400, "Invalid price");
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

  const inputDate = new Date(journeyDate);

  const journeyDateNormalized = new Date(
    Date.UTC(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate())
  );

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

    // Assign next available seats
    const assignedSeats = [];

    for (let i = 0; i < noOfPassengers; i++) {
      const seat = seatAvailability.seats.find((s) => s.isAvailable);

      if (!seat) {
        throw new ApiError(statusCode.CONFLICT, "Seats not available");
      }

      seat.isAvailable = false;
      seat.status = "booked";

      assignedSeats.push(seat.seatNumber);
    }

    // Assign seats to passengers
    const assignSeatToPassenger = passengers.map((passenger, index) => ({
      ...passenger,
      seatNumber: assignedSeats[index],
    }));

    const bookingId = await generateCustomId(EntityCodeEnum.BUS_BOOKING, "BB");

    // Create a new booking entry
    const newBooking = await BusBookingModel.create(
      [
        {
          bookingId,
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

    seatAvailability.bookedSeats = seatAvailability.seats.filter(
      (s) => !s.isAvailable
    ).length;

    seatAvailability.availableSeats =
      seatAvailability.seats.length - seatAvailability.bookedSeats;
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
      "busName bookingId busRegNumber busModelNumber createdAt updatedAt email phoneNumber"
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
  const cancelReason = req.body;

  const booking = await BusBookingModel.findById(bookingId).select(
    "paymentStatus status routeId busId journeyDate bookedBy busOperatorId price"
  );

  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }

  if (["Cancelled", "Completed"].includes(booking.status)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Your booking is already ${booking.status}`
    );
  }

  if (booking.paymentStatus === "PAID" && booking.bookedBy) {
    const refundAmount = booking.price * 0.5;

    // Refund 50% to user
    const userWallet = await Wallet.findOne({ userId: booking.bookedBy });
    if (!userWallet) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        "Wallet not found for this user"
      );
    }

    userWallet.balance += refundAmount;
    await userWallet.save();

    await Transaction.create({
      userId: booking.bookedBy,
      transactionId: await Transaction.generateTransactionId(),
      type: TransactionTypeEnum.CREDIT,
      amount: refundAmount,
      currency: userWallet.currency,
      description: `50% refund for cancelled booking ${bookingId}`,
      status: PaymentStatusEnum.SUCCESS,
    });

    // Deduct 50% from bus operator
    const operatorWallet = await Wallet.findOne({
      busOperatorId: booking.busOperatorId,
    });
    if (!operatorWallet) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        "Wallet not found for bus operator"
      );
    }

    if (operatorWallet.balance < refundAmount) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "Insufficient balance in bus operator wallet to process refund"
      );
    }

    operatorWallet.balance -= refundAmount;
    await operatorWallet.save();

    await Transaction.create({
      busOperatorId: booking.busOperatorId,
      transactionId: await Transaction.generateTransactionId(),
      type: TransactionTypeEnum.DEBIT,
      amount: refundAmount,
      currency: operatorWallet.currency,
      description: `Deduction for 50% refund of cancelled booking ${bookingId}`,
      status: PaymentStatusEnum.SUCCESS,
    });

    booking.paymentStatus = "PARTIAL_REFUNDED";
  }

  const bookedSeat = await BusSeatsLayoutModel.findOne({
    busId: booking.busId,
    journeyDate: booking.journeyDate,
    routeId: booking.routeId,
  });

  if (!bookedSeat) {
    throw new ApiError(statusCode.NOT_FOUND, "Booked seat layout not found");
  }

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
  booking.cancelledBy = "user";

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
      new ApiResponse(
        statusCode.OK,
        booking,
        "Booking cancelled successfully. 50% refunded to user and deducted from bus operator."
      )
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

const searchBuses = catchAsyncError(async (req, res, next) => {
  const { from, to, dateOfJourney } = req.query;

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;

  const reqField = ["from", "to", "dateOfJourney"];
  validateRequestBody(reqField, req.query);

  const getDay = getDayOfDate(dateOfJourney);

  const inputDate = new Date(dateOfJourney);

  const startOfDay = new Date(
    Date.UTC(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate())
  );

  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  console.log("SEARCH RANGE:", startOfDay, endOfDay);

  const query = {
    $and: [
      {
        $or: [
          { startLocation: { $regex: from, $options: "i" } },
          { "pickups.name": { $regex: from, $options: "i" } },
        ],
      },
      {
        $or: [
          { endLocation: { $regex: to, $options: "i" } },
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

  // ✅ Fetch routes + bus seats
  const findRoutes = await BusRouteModel.find(query)
    .populate("busId", "noOfSeats")
    .sort({ createdAt: -1 })
    .skip(startIndex)
    .limit(limit);

  if (!findRoutes.length) {
    return next(
      new ApiError(statusCode.NOT_FOUND, "No matching bus routes found")
    );
  }

  // ✅ Extract IDs safely
  const routeIds = findRoutes.map((r) => r._id);
  const busIds = findRoutes.map((r) => r.busId?._id).filter(Boolean);

  // ✅ DATE RANGE QUERY (IMPORTANT 🔥)
  const seatLayouts = await BusSeatsLayoutModel.find({
    routeId: { $in: routeIds },
    busId: { $in: busIds },
    journeyDate: {
      $gte: startOfDay,
      $lt: endOfDay,
    },
  });

  // ✅ Map for fast lookup
  const seatMap = new Map();

  seatLayouts.forEach((seat) => {
    const key = `${seat.busId.toString()}_${seat.routeId.toString()}`;
    seatMap.set(key, seat);
  });

  // ✅ Build response
  const updatedRoutes = await Promise.all(
    findRoutes.map(async (route) => {
      const key = `${route.busId._id.toString()}_${route._id.toString()}`;
      const seatData = seatMap.get(key);

      const totalSeats = route.busId?.noOfSeats || 0;

      const availableSeats = seatData ? seatData.availableSeats : totalSeats;

      const pricePerSeat = await getFinalPrice(
        "bus",
        route.pricePerSeat,
        new Date()
      );

      return {
        ...route.toObject(),
        totalSeats,
        availableSeats,
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

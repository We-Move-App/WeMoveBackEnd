const { createDecipheriv } = require("crypto");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const BusBookingModel = require("../../../models/bus-module/bus-bookings/bus-bookings.model");
const BusImagesModel = require("../../../models/bus-module/bus-images/bus-images.model");
const {
  validateRequestBody,
  normalizeDate,
  isValidFutureDate,
} = require("../../../utils/reqFunctions/reqFunction");
const BusModel = require("../../../models/bus-module/buses/buses.model");
const BusRouteModel = require("../../../models/bus-module/bus-routes/bus-routes.model");
const mongoose = require("mongoose");
const moment = require("moment");
const BusSeatsLayoutModel = require("../../../models/bus-module/bus-seats-management/buses-seats.model");
const { PaymentStatus } = require("../../../utils/constants/constants");
const ValidateSecurePin = require("../../../utils/services/securePin.services");

const getUserBusBookings = catchAsyncError(async (req, res, next) => {
  const { _id: userId } = req.user;

  const bookings = await BusBookingModel.find({ bookedBy: userId })
    .sort({ createdAt: -1 })
    .populate("busId", "busName")
    .populate("routeId", "startLocation endLocation departureTime arrivalTime")
    .select("seatNumbers paymentStatus journeyDate createdAt updatedAt routeId busId")
    .lean();

  if (!bookings || bookings.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "Bookings not found");
  }

  // Transform bookings: rename routeId fields + attach busImages
  const transformedBookings = await Promise.all(
    bookings.map(async (booking) => {
      // Create a new booking object to ensure we can modify properties
      const transformedBooking = { ...booking };

      if (transformedBooking.routeId) {
        transformedBooking.routeId = {
          _id: transformedBooking.routeId._id,
          departureTime: transformedBooking.routeId.departureTime,
          arrivalTime: transformedBooking.routeId.arrivalTime,
          from: transformedBooking.routeId.startLocation,
          to: transformedBooking.routeId.endLocation,
        };
      }


      // Add bus images if bus exists
      const busId = transformedBooking?.busId?._id;
      if (busId) {
        const busImagesDoc = await BusImagesModel.findOne(
          { busId },
          { images: 1 }
        ).lean();
        transformedBooking.busId = {
          ...transformedBooking.busId,
          busImages: busImagesDoc?.images?.map((img) => img.url) || [],
        };
      }

      return transformedBooking;
    })
  );

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      transformedBookings,
      "User bus bookings retrieved successfully"
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
      console.log("checking if bus not bus", seatAvailability);
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
      throw new ApiError(statusCode.CONFLICT, "Not enough available seats");
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
          bookedBy: userId,
          routeId,
          passengers: assignSeatToPassenger,
          noOfPassengers,
          price,
          journeyDate: journeyDateNormalized,
          termAndConditions,
          paymentStatus: PaymentStatus["PENDING"],
          from,
          to,
          seatNumbers: assignedSeats,
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
    const bookingWithBusDetails = await BusBookingModel.findById(newBooking[0]._id)
      .populate({
        path: "busId",
        select: "busName busRegNumber busModelNumber",
      }).lean()
      .populate({
    path: "routeId",
    model: "BusRoute", // 🔥 important: matches your model name
    select: "routeName startLocation endLocation departureTime arrivalTime estimatedTime totalDistance"
  })
  .lean()
  .populate({
    path: "bookedBy", // 👈 add this block
    model: "User",     // 👈 use your actual user model name
    select: "fullName email phoneNumber" // 👈 include fields you want
  })
  .lean();
  const busImages = await BusImagesModel.findOne(
  { busId: bookingWithBusDetails.busId._id },
  { images: 1, _id: 0 }
).lean();

// Attach to the response if available
if (busImages) {
  bookingWithBusDetails.busId.busImages = busImages.images;
}

if (bookingWithBusDetails.journeyDate) {
  bookingWithBusDetails.startDate = bookingWithBusDetails.journeyDate;
  bookingWithBusDetails.endDate = bookingWithBusDetails.journeyDate;
  delete bookingWithBusDetails.journeyDate;
}
if (bookingWithBusDetails.routeId) {
  bookingWithBusDetails.routeId.from = bookingWithBusDetails.routeId.startLocation;
  bookingWithBusDetails.routeId.to = bookingWithBusDetails.routeId.endLocation;

  delete bookingWithBusDetails.routeId.startLocation;
  delete bookingWithBusDetails.routeId.endLocation;
}

   

    return res
      .status(statusCode.CREATED)
      .json(
        new ApiResponse(
          statusCode.CREATED,

          bookingWithBusDetails,


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
    .populate("busId", "busName busRegNumber busModelNumber")
    .populate("bookedBy", "fullName email phoneNumber")
    .populate("routeId", "startLocation endLocation departureTime arrivalTime")
    .lean();
  if (booking?.routeId) {
    booking.routeId.from = booking.routeId.startLocation;
    booking.routeId.to = booking.routeId.endLocation;
    delete booking.routeId.startLocation;
    delete booking.routeId.endLocation;
  }
  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }
  const busId = booking?.busId?._id;
  if (busId) {
    const busImagesDoc = await BusImagesModel.findOne({ busId }, { images: 1 }).lean();
    booking.busId.busImages = busImagesDoc?.images?.map(img => img.url) || [];
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

const cancelBusBooking = catchAsyncError(async (req, res, next) => {
  const { bookingId } = req.params;
  const { cancelReason } = req.body;

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
  if (cancelReason) {
    booking.cancelReason = cancelReason;
  }
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
      new ApiResponse(statusCode.OK, booking, "Booking cancelled successfully")
    );
});

const payBusBookingPayment = catchAsyncError(async (req, res, next) => {
  const { securePin } = req.body;

  const { bookingId } = req.params;

  await ValidateSecurePin({
    req,
    securePin,
  });

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, {}, "Payment Successfully Done"));
});

module.exports = {
  getUserBusBookings,
  createBusBooking,
  getBusBookingDetails,
  cancelBusBooking,
  payBusBookingPayment,
};

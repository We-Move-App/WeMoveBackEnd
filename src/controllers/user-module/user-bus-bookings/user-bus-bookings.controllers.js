const { createDecipheriv } = require("crypto");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const BusBookingModel = require("../../../models/bus-module/bus-bookings/bus-bookings.model");
const BusImagesModel = require("../../../models/bus-module/bus-images/bus-images.model");
const WalletModel = require("../../../models/wallet-module/wallets.model");
const TransactionModel = require("../../../models/transaction-module/transaction.model");
const { v4: uuidv4 } = require("uuid");
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
const {
  PaymentStatusEnum,
  TransactionTypeEnum,
  EntityCodeEnum,
} = require("../../../utils/constants/ENUM");
const Commission = require("../../../models/admin-module/commission-management/commission.model");
const {
  CouponModel,
} = require("../../../models/admin-module/Admin-coupon/adminCouponModel");
const {
  AdminModel,
} = require("../../../models/admin-module/admin/admin.model");
const generateCustomId = require("../../../utils/customId/generateCustomId");

const getUserBusBookings = catchAsyncError(async (req, res, next) => {
  const { _id: userId } = req.user;

  const bookings = await BusBookingModel.find({ bookedBy: userId })
    .sort({ createdAt: -1 })
    .populate("busId", "busName")
    .populate("routeId", "startLocation endLocation departureTime arrivalTime")
    .select(
      " bookingId seatNumbers paymentStatus journeyDate createdAt updatedAt routeId busId"
    )
    .lean();

  if (!bookings || bookings.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "Bookings not found");
  }

  const transformedBookings = await Promise.all(
    bookings.map(async (booking) => {
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

  return res
    .status(statusCode.OK)
    .json(
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
    noOfPassengers,
    passengers,
    couponCode,
    journeyDate,
    termAndConditions,
  } = req.body;

  // 1️⃣ Validate request
  validateRequestBody(
    [
      "from",
      "to",
      "busId",
      "routeId",
      "passengers",
      "noOfPassengers",
      "journeyDate",
    ],
    req.body
  );

  if (noOfPassengers !== passengers.length) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Passenger count does not match the number of selected seats"
    );
  }

  isValidFutureDate(journeyDate);

  // 2️⃣ Get bus and route details
  const [findBus, route] = await Promise.all([
    BusModel.findById(busId).lean(),
    BusRouteModel.findById(routeId).lean(),
  ]);

  if (!findBus) throw new ApiError(statusCode.NOT_FOUND, "Bus not found");
  if (!route) throw new ApiError(statusCode.NOT_FOUND, "Route not found");

  const journeyDateNormalized = normalizeDate(journeyDate);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 3️⃣ Seat availability & auto assignment
    let seatAvailability = await BusSeatsLayoutModel.findOne({
      busId,
      journeyDate: journeyDateNormalized,
      routeId,
    }).session(session);

    if (!seatAvailability) {
      const busSeats = Array.from({ length: findBus.noOfSeats }, (_, i) => ({
        seatNumber: `S${i + 1}`,
        isAvailable: true,
        seatType: "regular",
        status: "available",
      }));

      seatAvailability = await BusSeatsLayoutModel.create(
        [
          {
            busId,
            seats: busSeats,
            noOfSeats: findBus.noOfSeats,
            bookedSeats: 0,
            availableSeats: findBus.noOfSeats,
            journeyDate: journeyDateNormalized,
            routeId,
          },
        ],
        { session }
      );
      seatAvailability = seatAvailability[0];
    }

    const availableSeats = seatAvailability.seats.filter(
      (seat) => seat.isAvailable
    );
    if (availableSeats.length < noOfPassengers) {
      throw new ApiError(statusCode.CONFLICT, "Not enough available seats");
    }

    const assignedSeats = availableSeats
      .slice(0, noOfPassengers)
      .map((s) => s.seatNumber);
    const assignSeatToPassenger = passengers.map((p, i) => ({
      ...p,
      seatNumber: assignedSeats[i],
    }));

    // 4️⃣ Calculate price
    const basePricePerSeat = route.pricePerSeat || findBus.pricePerSeat || 0;
    const basePrice = basePricePerSeat * noOfPassengers;

    let appliedCoupon = null;
    let couponMessage = null;
    let finalAmount = basePrice;

    if (couponCode) {
      const currentDate = new Date();

      const coupon = await CouponModel.findOne({
        couponCode,
        status: "Active",
        serviceType: { $in: ["Bus", "All Services"] },
      });

      if (!coupon) {
        couponMessage = "Coupon code is invalid.";
      } else if (coupon.expiryDate < currentDate) {
        couponMessage = "Coupon code has expired.";
      } else if (
        coupon.usageHistory.some(
          (u) => u.userId.toString() === userId.toString()
        )
      ) {
        couponMessage = "You have already used this coupon.";
      } else if (basePrice < coupon.minOrderAmount) {
        couponMessage = `Coupon valid only on orders above ₹${coupon.minOrderAmount}.`;
      } else {
        // ✅ Apply discount
        if (coupon.discountType === "Percentage") {
          finalAmount =
            basePrice - (basePrice * coupon.discountPercentage) / 100;
        } else if (coupon.discountType === "Fixed Amount") {
          finalAmount = basePrice - coupon.discountAmount;
        }

        if (finalAmount < 0) finalAmount = 0;

        appliedCoupon = coupon;
        couponMessage = `Booking confirmed. Coupon ${coupon.couponCode} applied successfully.`;
      }
    } else {
      couponMessage = "Booking confirmed. No coupon applied.";
    }
    //Check user wallet balance
    const userWallet = await WalletModel.findOne({ userId }).session(session);
    if (!userWallet || userWallet.balance < finalAmount) {
      await TransactionModel.create(
        [
          {
            transactionId: uuidv4(),
            userId,
            bookingId: null,
            type: "DEBIT",
            status: PaymentStatusEnum.FAILED,
            amount: finalAmount,
            currency: process.env.MOMO_CURRENCY,
            description: "Bus booking failed - insufficient balance",
          },
        ],
        { session }
      );
      throw new ApiError(statusCode.BAD_REQUEST, "Insufficient wallet balance");
    }

    // Step 3: Create booking

    const bookingId = await generateCustomId(EntityCodeEnum.BUS_BOOKING, "BB");

    const [newBooking] = await BusBookingModel.create(
      [
        {
          busId,
          bookingId,
          bookedBy: userId,
          routeId,
          passengers: assignSeatToPassenger,
          noOfPassengers,
          finalAmount,
          price: basePrice,
          journeyDate: journeyDateNormalized,
          termAndConditions,
          paymentStatus: "PAID",
          from,
          to,
          seatNumbers: assignedSeats,
          coupon: appliedCoupon
            ? {
                couponId: appliedCoupon._id,
                couponCode: appliedCoupon.couponCode,
                discountType: appliedCoupon.discountType,
                discountValue:
                  appliedCoupon.discountType === "Percentage"
                    ? appliedCoupon.discountPercentage
                    : appliedCoupon.discountAmount,
                discountApplied,
              }
            : null,
        },
      ],
      { session }
    );

    // 7️⃣ Update seats
    seatAvailability.seats = seatAvailability.seats.map((seat) => {
      if (assignedSeats.includes(seat.seatNumber)) {
        seat.status = "booked";
        seat.bookingReference = newBooking._id;
        seat.isAvailable = false;
      }
      return seat;
    });
    seatAvailability.bookedSeats += noOfPassengers;
    seatAvailability.availableSeats -= noOfPassengers;
    await seatAvailability.save({ session });

    // 8️⃣ Deduct from user wallet
    userWallet.balance -= finalAmount;
    await userWallet.save({ session });

    // 9️⃣ Commission & platform split
    const commission = await Commission.findOne({ serviceType: "bus" }).lean();
    let platformFee = 0;
    let operatorShare = finalAmount;

    if (commission && commission.status === "active") {
      if (commission.commissionType === "fixed" && commission.commissionRate) {
        platformFee = commission.commissionRate;
        operatorShare = finalAmount - platformFee;
      } else if (
        commission.commissionType === "percentage" &&
        commission.commissionPercentage
      ) {
        platformFee = parseFloat(
          ((finalAmount * commission.commissionPercentage) / 100).toFixed(2)
        );
        operatorShare = finalAmount - platformFee;
      }
    }
    if (operatorShare < 0) operatorShare = 0;

    const ownerId = findBus.ownerId.toString();
    await WalletModel.findOneAndUpdate(
      { userId: ownerId },
      { $inc: { balance: operatorShare } },
      { session, new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const superAdmin = await AdminModel.findOne({ role: "SuperAdmin" });
    const adminId = superAdmin?._id || "ADM001";
    await WalletModel.findOneAndUpdate(
      { userId: adminId },
      { $inc: { balance: platformFee } },
      { session, new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // 10️⃣ Transactions
    await TransactionModel.insertMany(
      [
        {
          transactionId: uuidv4(),
          userId,
          bookingId: newBooking._id,
          type: "DEBIT",
          status: PaymentStatusEnum.SUCCESS,
          amount: finalAmount,
          currency: process.env.MOMO_CURRENCY,
          description: `Bus booking ${from} → ${to}`,
        },
        {
          transactionId: uuidv4(),
          busOperatorId: ownerId,
          bookingId: newBooking._id,
          type: "CREDIT",
          status: PaymentStatusEnum.SUCCESS,
          amount: operatorShare,
          currency: process.env.MOMO_CURRENCY,
          description: "Earnings from booking",
        },
        {
          transactionId: uuidv4(),
          adminId,
          bookingId: newBooking._id,
          type: "CREDIT",
          status: PaymentStatusEnum.SUCCESS,
          amount: platformFee,
          currency: process.env.MOMO_CURRENCY,
          description: `Commission from bus booking ${busId}`,
        },
      ],
      { session }
    );

    // 11️⃣ Update coupon usage
    if (appliedCoupon) {
      await CouponModel.findByIdAndUpdate(
        appliedCoupon._id,
        {
          $inc: { usedCount: 1 },
          $push: {
            usageHistory: {
              userId,
              bookingId: newBooking._id,
              usedAt: new Date(),
            },
          },
        },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    // 12️⃣ Populate response
    const bookingWithBusDetails = await BusBookingModel.findById(newBooking._id)
      .populate({
        path: "busId",
        select: "busName busRegNumber busModelNumber",
      })
      .populate({
        path: "routeId",
        select:
          "routeName startLocation endLocation departureTime arrivalTime estimatedTime totalDistance",
      })
      .populate({
        path: "bookedBy",
        model: "User",
        select: "fullName email phoneNumber",
      })
      .lean();

    const busImages = await BusImagesModel.findOne(
      { busId: bookingWithBusDetails.busId._id },
      { images: 1, _id: 0 }
    ).lean();
    bookingWithBusDetails.busId.busImages =
      busImages?.images?.map((img) => img.url) || [];
    bookingWithBusDetails.passengers = assignSeatToPassenger;

    if (bookingWithBusDetails.journeyDate) {
      bookingWithBusDetails.startDate = bookingWithBusDetails.journeyDate;
      bookingWithBusDetails.endDate = bookingWithBusDetails.journeyDate;
      delete bookingWithBusDetails.journeyDate;
    }
    if (bookingWithBusDetails.routeId) {
      bookingWithBusDetails.routeId.from =
        bookingWithBusDetails.routeId.startLocation;
      bookingWithBusDetails.routeId.to =
        bookingWithBusDetails.routeId.endLocation;
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

const calculateBusBooking = catchAsyncError(async (req, res, next) => {
  const { _id: userId } = req.user;
  const {
    busId,
    routeId,
    noOfPassengers,
    passengers,
    journeyDate,
    couponCode,
  } = req.body;

  // 1️⃣ Validate request
  validateRequestBody(
    ["busId", "routeId", "passengers", "noOfPassengers", "journeyDate"],
    req.body
  );

  if (!Array.isArray(passengers) || passengers.length === 0)
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Passengers array cannot be empty"
    );

  if (noOfPassengers !== passengers.length) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Passenger count does not match the number of selected seats"
    );
  }

  isValidFutureDate(journeyDate);

  // 2️⃣ Get bus and route details
  const [findBus, route] = await Promise.all([
    BusModel.findById(busId).lean(),
    BusRouteModel.findById(routeId).lean(),
  ]);

  if (!findBus) throw new ApiError(statusCode.NOT_FOUND, "Bus not found");
  if (!route) throw new ApiError(statusCode.NOT_FOUND, "Route not found");

  // 3️⃣ Normalize journey date
  const journeyDateNormalized = normalizeDate(journeyDate);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 4️⃣ Seat availability
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

    const availableSeats = seatAvailability.seats.filter(
      (seat) => seat.isAvailable
    );
    if (availableSeats.length < noOfPassengers) {
      throw new ApiError(statusCode.CONFLICT, "Not enough available seats");
    }

    const assignedSeats = availableSeats
      .slice(0, noOfPassengers)
      .map((s) => s.seatNumber);
    const assignSeatToPassenger = passengers.map((p, i) => ({
      ...p,
      seatNumber: assignedSeats[i],
    }));

    // 5️⃣ Calculate pricing
    // 5️⃣ Calculate pricing
    const basePricePerSeat = route.pricePerSeat || findBus.pricePerSeat || 0;
    const basePrice = basePricePerSeat * noOfPassengers;
    let discountApplied = 0;
    let finalAmount = basePrice;
    let appliedCoupon = null;

    let couponMessage = "Price calculated successfully.";

    // ✅ Coupon logic same as hotel
    if (couponCode) {
      const currentDate = new Date();
      const coupon = await CouponModel.findOne({
        couponCode,
        status: "Active",
        serviceType: { $in: ["Bus", "All Services"] },
      });

      if (!coupon) {
        couponMessage = "Coupon code is invalid.";
      } else if (coupon.expiryDate < currentDate) {
        couponMessage = "Coupon code has expired.";
      } else if (
        coupon.usageHistory.some(
          (u) => u.userId.toString() === userId.toString()
        )
      ) {
        couponMessage = "You have already used this coupon.";
      } else if (basePrice < coupon.minOrderAmount) {
        couponMessage = `Coupon valid only on orders above ₹${coupon.minOrderAmount}.`;
      } else {
        // ✅ Apply discount
        if (coupon.discountType === "Percentage") {
          discountApplied = (basePrice * coupon.discountPercentage) / 100;
        } else if (coupon.discountType === "Fixed Amount") {
          discountApplied = coupon.discountAmount;
        }
        finalAmount = Math.max(0, basePrice - discountApplied);

        appliedCoupon = coupon;
        couponMessage = `Coupon ${coupon.couponCode} applied successfully.`;
      }
    }

    await session.commitTransaction();
    session.endSession();

    // 6️⃣ Return response
    return res.status(statusCode.OK).json({
      success: true,
      message: couponMessage,
      data: {
        journeyDate: journeyDateNormalized,
        noOfPassengers,
        assignedSeats,
        pricePerSeat: basePricePerSeat,
        basePrice,
        discountApplied,
        finalAmount,
        coupon: appliedCoupon
          ? {
              couponCode: appliedCoupon.couponCode,
              discountType: appliedCoupon.discountType,
              discountValue:
                appliedCoupon.discountType === "Percentage"
                  ? appliedCoupon.discountPercentage
                  : appliedCoupon.discountAmount,
            }
          : null,
      },
    });
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
    const busImagesDoc = await BusImagesModel.findOne(
      { busId },
      { images: 1 }
    ).lean();
    booking.busId.busImages = busImagesDoc?.images?.map((img) => img.url) || [];
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
    "paymentStatus status routeId busId journeyDate bookedBy finalAmount "
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

  const bus = await BusModel.findById(booking.busId).select(
    "cancellationWindowInHours"
  );
  const route = await BusRouteModel.findById(booking.routeId).select(
    "departureTime"
  );

  if (!bus || !route) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus or Route details not found");
  }

  const journeyDate = new Date(booking.journeyDate);
  let startDate = new Date(journeyDate);

  if (route.departureTime) {
    const [dh, dm] = route.departureTime.split(":").map(Number);
    startDate.setHours(dh || 0, dm || 0, 0, 0);
  }

  if (booking.paymentStatus === "PAID") {
    const refundAmount = booking.finalAmount * 0.5;

    const operatorTxn = await TransactionModel.findOne({
      bookingId,
      busOperatorId: { $ne: null },
      type: TransactionTypeEnum.CREDIT,
    }).select("busOperatorId currency amount");

    if (!operatorTxn) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        "Transaction not found for this booking"
      );
    }
    const busOperatorId = operatorTxn.busOperatorId;

    const userWallet = await WalletModel.findOne({ userId: booking.bookedBy });
    if (!userWallet) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        "Wallet not found for this user"
      );
    }

    userWallet.balance += refundAmount;
    await userWallet.save();

    await TransactionModel.create({
      userId: booking.bookedBy,
      bookingId,
      transactionId: uuidv4(),
      type: TransactionTypeEnum.CREDIT,
      amount: refundAmount,
      currency: userWallet.currency,
      description: `50% refund for cancelled booking ${bookingId}`,
      status: PaymentStatusEnum.SUCCESS,
      refund: true,
    });

    const operatorWallet = await WalletModel.findOne({ userId: busOperatorId });
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

    await TransactionModel.create({
      busOperatorId,
      bookingId,
      transactionId: uuidv4(),
      type: TransactionTypeEnum.DEBIT,
      amount: refundAmount,
      currency: operatorWallet.currency,
      description: `Deduction for 50% refund of cancelled booking ${bookingId}`,
      status: PaymentStatusEnum.SUCCESS,
      refund: true,
    });

    booking.paymentStatus = "REFUNDED";
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

  // sanitize response
  const bookingResponse = {
    journeyDate: booking.journeyDate,
    paymentStatus: booking.paymentStatus,
    price: booking.finalAmount,
    status: booking.status,
    cancelReason: booking.cancelReason,
    cancelledBy: booking.cancelledBy,
    updatedAt: booking.updatedAt,
  };

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        bookingResponse,
        "Booking cancelled successfully"
      )
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
// const UpcomingBusBookings = catchAsyncError(async (req, res) => {
//   const { page = 1, limit = 10 } = req.query;
//   const userId = req.user._id;

//   const today = new Date();
//   today.setHours(0, 0, 0, 0);

//   const query = {
//     bookedBy: userId,
//     journeyDate: { $gte: today }
//   };

//   const skip = (parseInt(page) - 1) * parseInt(limit);

//   const bookings = await BusBookingModel.find(query)
//     .sort({ journeyDate: 1 })
//     .skip(skip)
//     .limit(parseInt(limit))
//     .populate({
//       path: "busId",
//       model: "Bus",
//       select: "-__v -routes -createdAt -updatedAt"
//     })
//     .populate({
//       path: "routeId",
//       model: "BusRoute",
//       select: "-__v"
//     })
//     .populate({
//       path: "bookedBy",
//       model: "User",
//       select: "-__v -password"
//     })
//     .lean();

//   const enhancedBookings = await Promise.all(
//     bookings.map(async (booking) => {
//       const journeyDate = new Date(booking.journeyDate);

//       // Derive startDate from journeyDate + departureTime
//       let startDate = new Date(journeyDate);
//       if (booking.routeId?.departureTime) {
//         const [dh, dm] = booking.routeId.departureTime.split(":").map(Number);
//         startDate.setHours(dh || 0, dm || 0, 0, 0);
//       }

//       // Derive endDate from journeyDate + arrivalTime
//       let endDate = new Date(journeyDate);
//       if (booking.routeId?.arrivalTime) {
//         const [ah, am] = booking.routeId.arrivalTime.split(":").map(Number);
//         endDate.setHours(ah || 0, am || 0, 0, 0);
//         // If endDate is before startDate, assume next day arrival
//         if (endDate <= startDate) {
//           endDate.setDate(endDate.getDate() + 1);
//         }
//       }

//       // Calculate time left in hours
//       const now = new Date();
//       const diffMs = startDate - now;
//       const hoursLeft = diffMs > 0 ? Math.floor(diffMs / (1000 * 60 * 60)) : 0;

//       // Cancellation logic: from bus model or default 24 hours
//       const cancellationWindow = booking.busId?.cancellationWindowInHours ?? 24;
//       const isCancellable = hoursLeft >= cancellationWindow;

//       // Fetch and embed bus images
//       let imageUrls = [];
//       try {
//         const busImageDoc = await BusImagesModel.findOne({ busId: booking.busId?._id }).select("images");
//         if (busImageDoc?.images?.length) {
//           imageUrls = busImageDoc.images.map((img) => img.url);
//         }
//       } catch (err) {
//         console.warn("Failed to fetch bus images for:", booking.busId?._id, err);
//       }

//       return {
//         ...booking,
//         startDate,
//         endDate,
//         hoursLeft,
//         isCancellable,
//         busId: {
//           ...booking.busId,
//           busImages: imageUrls,
//         },
//         journeyDate: undefined // Optional: remove original if not needed
//       };
//     })
//   );

//   const totalBookings = await BusBookingModel.countDocuments(query);
//   const totalPages = Math.ceil(totalBookings / parseInt(limit));

//   return res.status(statusCode.OK).json(
//     new ApiResponse(
//       statusCode.OK,
//       {
//         totalBookings,
//         totalPages,
//         currentPage: parseInt(page),
//         limit: parseInt(limit),
//         bookings: enhancedBookings
//       },
//       "Upcoming bus bookings fetched successfully"
//     )
//   );
// });

const UpcomingBusBookings = catchAsyncError(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const userId = req.user._id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const query = {
    bookedBy: userId,
    journeyDate: { $gte: today },
    status: "Booked",
  };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const bookings = await BusBookingModel.find(query)
    .sort({ journeyDate: 1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate({
      path: "busId",
      model: "Bus",
      select: "busName busModelNumber busRegNumber cancellationWindowInHours",
    })
    .populate({
      path: "routeId",
      model: "BusRoute",
      select: "departureTime arrivalTime",
    })
    .populate({
      path: "bookedBy",
      model: "User",
      select: "fullName email phoneNumber",
    })
    .lean();

  const enhancedBookings = await Promise.all(
    bookings.map(async (booking) => {
      const journeyDate = new Date(booking.journeyDate);

      let startDate = new Date(journeyDate);
      if (booking.routeId?.departureTime) {
        const [dh, dm] = booking.routeId.departureTime.split(":").map(Number);
        startDate.setHours(dh || 0, dm || 0, 0, 0);
      }

      let endDate = new Date(journeyDate);
      if (booking.routeId?.arrivalTime) {
        const [ah, am] = booking.routeId.arrivalTime.split(":").map(Number);
        endDate.setHours(ah || 0, am || 0, 0, 0);
        if (endDate <= startDate) {
          endDate.setDate(endDate.getDate() + 1);
        }
      }

      const now = new Date();
      const diffMs = startDate - now;
      const hoursLeft = diffMs > 0 ? Math.floor(diffMs / (1000 * 60 * 60)) : 0;

      const cancellationWindow = booking.busId?.cancellationWindowInHours ?? 24;
      const isCancellable = hoursLeft >= cancellationWindow;

      let imageUrls = [];
      try {
        const busImageDoc = await BusImagesModel.findOne({
          busId: booking.busId?._id,
        }).select("images");
        if (busImageDoc?.images?.length) {
          imageUrls = busImageDoc.images.map((img) => img.url);
        }
      } catch (err) {
        console.warn(
          "Failed to fetch bus images for:",
          booking.busId?._id,
          err
        );
      }

      return {
        ...booking,
        startDate,
        endDate,
        hoursLeft,
        isCancellable,
        busId: {
          ...booking.busId,
          busImages: imageUrls,
        },
        journeyDate: undefined,
      };
    })
  );

  const totalBookings = await BusBookingModel.countDocuments(query);
  const totalPages = Math.ceil(totalBookings / parseInt(limit));

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        totalBookings,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit),
        bookings: enhancedBookings,
      },
      "Upcoming bus bookings fetched successfully"
    )
  );
});

// ----
const OldBusBookings = catchAsyncError(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const userId = req.user._id;

  const now = new Date();

  const query = {
    bookedBy: userId,
    journeyDate: { $lt: now },
    status: "Completed",
  };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const bookings = await BusBookingModel.find(query)
    .sort({ journeyDate: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate({
      path: "busId",
      model: "Bus",
      select: "busName busModelNumber busRegNumber",
    })
    .populate({
      path: "routeId",
      model: "BusRoute",
      select: "departureTime arrivalTime",
    })
    .populate({
      path: "bookedBy",
      model: "User",
      select: "fullName email phoneNumber",
    })
    .lean();

  const enhancedBookings = await Promise.all(
    bookings.map(async (booking) => {
      const journeyDate = new Date(booking.journeyDate);

      let startDate = new Date(journeyDate);
      if (booking.routeId?.departureTime) {
        const [dh, dm] = booking.routeId.departureTime.split(":").map(Number);
        startDate.setHours(dh || 0, dm || 0, 0, 0);
      }

      let endDate = new Date(journeyDate);
      if (booking.routeId?.arrivalTime) {
        const [ah, am] = booking.routeId.arrivalTime.split(":").map(Number);
        endDate.setHours(ah || 0, am || 0, 0, 0);
        if (endDate <= startDate) {
          endDate.setDate(endDate.getDate() + 1);
        }
      }

      let imageUrls = [];
      try {
        const busImageDoc = await BusImagesModel.findOne({
          busId: booking.busId?._id,
        }).select("images");
        if (busImageDoc?.images?.length) {
          imageUrls = busImageDoc.images.map((img) => img.url);
        }
      } catch (err) {
        console.warn("Bus image fetch failed for:", booking.busId?._id, err);
      }

      return {
        ...booking,
        startDate,
        endDate,
        rebookable: true, // ✅ instead of cancellable
        busId: {
          ...booking.busId,
          busImages: imageUrls,
        },
        journeyDate: undefined,
      };
    })
  );

  const totalBookings = await BusBookingModel.countDocuments(query);
  const totalPages = Math.ceil(totalBookings / parseInt(limit));

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        totalBookings,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit),
        bookings: enhancedBookings,
      },
      "Old bus bookings fetched successfully"
    )
  );
});

module.exports = {
  getUserBusBookings,
  createBusBooking,
  calculateBusBooking,
  getBusBookingDetails,
  cancelBusBooking,
  payBusBookingPayment,
  UpcomingBusBookings,
  OldBusBookings,
};

const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const BusBookingModel = require("../../../models/bus-module/bus-bookings/bus-bookings.model");
const BusImagesModel = require("../../../models/bus-module/bus-images/bus-images.model");
const WalletModel = require("../../../models/wallet-module/wallets.model");
const TransactionModel = require("../../../models/transaction-module/transaction.model");
const {
  validateRequestBody,
  normalizeDate,
  isValidFutureDate,
} = require("../../../utils/reqFunctions/reqFunction");
const BusModel = require("../../../models/bus-module/buses/buses.model");
const BusRouteModel = require("../../../models/bus-module/bus-routes/bus-routes.model");
const mongoose = require("mongoose");
const BusSeatsLayoutModel = require("../../../models/bus-module/bus-seats-management/buses-seats.model");
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
const Transaction = require("../../../models/transaction-module/transaction.model");
const UserModel = require("../../../models/user-module/users/user.model");
const { fetchLn } = require("../../../utils/services/user.services");
const { translateLn } = require("../../../utils/services/translator.service");
const BusTravellerModel = require("../../../models/bus-module/bus-traveller/bus-traveller.model");
const {
  createNotification,
} = require("../../global-notification-module/global-notification.controller");
const BusOperatorModel = require("../../../models/bus-module/bus-operator/bus-operator.model");

const getUserBusBookings = catchAsyncError(async (req, res, next) => {
  const { _id: userId } = req.user;

  const ln = await fetchLn(userId);

  const bookings = await BusBookingModel.find({ bookedBy: userId })
    .sort({ createdAt: -1 })
    .populate("busId", "busName")
    .populate("routeId", "startLocation endLocation departureTime arrivalTime")
    .select(
      " bookingId seatNumbers paymentStatus journeyDate createdAt updatedAt routeId busId"
    )
    .lean();

  if (!bookings || bookings.length === 0) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "BOOKINGS_NOT_FOUND")
    );
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
        translateLn(ln, "BUS_BOOKINGS_FETCHED")
      )
    );
});

const createBusBooking = catchAsyncError(async (req, res) => {
  const { _id: userId } = req.user;
  const id = req.user.userId;

  const {
    from,
    to,
    busId,
    routeId,
    passengers,
    noOfPassengers,
    journeyDate,
    price,
    commission,
    discountApplied = 0,
    coupon,
    termAndConditions,
  } = req.body;

  const ln = await fetchLn(userId);

  validateRequestBody(
    [
      "from",
      "to",
      "busId",
      "routeId",
      "passengers",
      "noOfPassengers",
      "journeyDate",
      "price",
      "commission",
    ],
    req.body
  );

  if (!Array.isArray(passengers) || passengers.length !== noOfPassengers) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "PASSENGER_COUNT_MISMATCH")
    );
  }

  isValidFutureDate(journeyDate);

  const inputDate = new Date(journeyDate);
  const journeyDateNormalized = new Date(
    Date.UTC(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate())
  );

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        translateLn(ln, "USER_NOT_FOUND")
      );
    }

    /* ---------- BUS & ROUTE ---------- */
    const [bus, route] = await Promise.all([
      BusModel.findById(busId).lean(),
      BusRouteModel.findById(routeId).lean(),
    ]);

    if (!bus)
      throw new ApiError(
        statusCode.NOT_FOUND,
        translateLn(ln, "BUS_NOT_FOUND")
      );
    if (!route)
      throw new ApiError(
        statusCode.NOT_FOUND,
        translateLn(ln, "ROUTE_NOT_FOUND")
      );

    /* ---------- AMOUNT CALCULATION ---------- */
    const finalAmount = Math.max(0, price - discountApplied);
    const operatorAmount = Math.max(0, finalAmount - commission);

    /* ---------- WALLET CHECK ---------- */
    const wallet = await WalletModel.findOne({ userId }).session(session);
    if (!wallet || wallet.balance < finalAmount) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        translateLn(ln, "INSUFFICIENT_BALANCE")
      );
    }

    let seatAvailability = await BusSeatsLayoutModel.findOne({
      busId,
      routeId,
      journeyDate: journeyDateNormalized,
    }).session(session);

    const totalSeats = Number(bus.noOfSeats);

    if (!seatAvailability) {
      const seats = Array.from({ length: totalSeats }, (_, i) => ({
        seatNumber: `S${i + 1}`,
        isAvailable: true,
        status: "available",
      }));

      const created = await BusSeatsLayoutModel.create(
        [
          {
            busId,
            routeId,
            journeyDate: journeyDateNormalized,
            seats,
            noOfSeats: totalSeats,
            bookedSeats: 0,
            availableSeats: totalSeats,
          },
        ],
        { session }
      );

      seatAvailability = created[0];
    }

    // const availableSeats = seatAvailability.seats.filter((s) => s.isAvailable);

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

    passengers.forEach((p, i) => {
      p.seatNumber = assignedSeats[i];
    });

    /* ---------- CREATE BOOKING ---------- */
    const bookingId = await generateCustomId(EntityCodeEnum.BUS_BOOKING, "BB");

    const [booking] = await BusBookingModel.create(
      [
        {
          bookingId,
          busId,
          routeId,
          bookedBy: userId,
          passengers,
          noOfPassengers,
          price,
          discountApplied,
          finalAmount,
          adminCommission: commission,
          operatorAmount,
          journeyDate: journeyDateNormalized,
          paymentStatus: "PAID",
          from,
          to,
          termAndConditions,
          coupon,
        },
      ],
      { session }
    );

    seatAvailability.seats = seatAvailability.seats.map((seat) => {
      if (assignedSeats.includes(seat.seatNumber)) {
        seat.bookingReference = booking._id;
      }
      return seat;
    });
    seatAvailability.bookedSeats = seatAvailability.seats.filter(
      (s) => !s.isAvailable
    ).length;
    seatAvailability.availableSeats =
      seatAvailability.seats.length - seatAvailability.bookedSeats;

    await seatAvailability.save({ session });

    /* ---------- USER WALLET ---------- */
    wallet.balance -= finalAmount;
    await wallet.save({ session });

    /* ---------- OPERATOR WALLET ---------- */
    await WalletModel.findOneAndUpdate(
      { userId: bus.ownerId },
      { $inc: { balance: operatorAmount } },
      { session, upsert: true }
    );

    /* ---------- ADMIN WALLET ---------- */
    const admin = await AdminModel.findOne({ role: "SuperAdmin" });
    if (!admin) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        translateLn(ln, "ADMIN_NOT_FOUND")
      );
    }

    await WalletModel.findOneAndUpdate(
      { userId: admin._id },
      { $inc: { balance: commission } },
      { session, upsert: true }
    );

    const busOperator = await BusOperatorModel.findById(bus.ownerId);

    /* ---------- TRANSACTION ---------- */
    await TransactionModel.create(
      [
        {
          transactionId: await TransactionModel.generateTransactionId(),
          transactionType: "Bus Booking",
          bookingId: booking.bookingId,
          status: PaymentStatusEnum.SUCCESS,
          totalAmount: finalAmount,
          description: {
            en: `Bus booking from ${from} to ${to}`,
            fr: `Réservation de bus de ${from} à ${to}`,
          },
          platformFee: commission,
          operatorShare: finalAmount - commission,
          entries: [
            {
              entityType: "USER",
              entityId: userId,
              type: "DEBIT",
              amount: finalAmount,
            },
            {
              entityType: "BUS_OPERATOR",
              entityId: busOperator?.operatorId || bus?.ownerId,
              type: "CREDIT",
              amount: operatorAmount,
            },
            {
              entityType: "ADMIN",
              entityId: admin._id,
              type: "CREDIT",
              amount: commission,
            },
          ],
          meta: {
            from: {
              name: user?.fullName,
              id: user?.userId,
            },
            to: {
              name: bus?.busName,
              id: busOperator?.operatorId || bus?.ownerId,
            },
            bus: {
              bookingId: booking.bookingId,
            },
          },
        },
      ],
      { session }
    );

    /* ---------- COUPON ---------- */
    if (coupon?.couponId) {
      await CouponModel.findByIdAndUpdate(
        coupon.couponId,
        {
          $inc: { usedCount: 1 },
          $push: {
            usageHistory: {
              userId,
              bookingId: booking._id,
              usedAt: new Date(),
            },
          },
        },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    /* ---------- RESPONSE (UNCHANGED) ---------- */
    const bookingWithDetails = await BusBookingModel.findById(booking._id)
      .populate("busId", "busName busRegNumber busModelNumber")
      .populate(
        "routeId",
        "routeName startLocation endLocation departureTime arrivalTime estimatedTime totalDistance"
      )
      .populate("bookedBy", "fullName email phoneNumber")
      .lean();

    bookingWithDetails.passengers = passengers;
    bookingWithDetails.seatNumbers =
      passengers.map((p) => p.seatNumber).filter(Boolean) || [];

    try {
      await Promise.all([
        createNotification(
          userId,
          {
            en: "Bus Booking Confirmed",
            fr: "Réservation de bus confirmée",
          },
          {
            en: `Your booking ${booking.bookingId} at ${bus.busName} is confirmed`,
            fr: `Votre réservation ${booking.bookingId} à ${bus.busName} est confirmée`,
          }
        ),

        createNotification(
          bus.ownerId,
          {
            en: "New Bus Booking",
            fr: "Nouvelle réservation de bus",
          },
          {
            en: `You received a new booking ${booking.bookingId}`,
            fr: `Vous avez reçu une nouvelle réservation ${booking.bookingId}`,
          }
        ),
      ]);
    } catch (err) {
      console.error("Notification error:", err.message);
    }

    return res
      .status(statusCode.CREATED)
      .json(
        new ApiResponse(
          statusCode.CREATED,
          bookingWithDetails,
          translateLn(ln, "BUS_BOOKED_SUCCESS")
        )
      );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

const calculateBusBooking = catchAsyncError(async (req, res) => {
  const id = req.user._id;
  const { _id: userId } = req.user;
  const {
    busId,
    routeId,
    passengers,
    noOfPassengers,
    journeyDate,
    couponCode,
  } = req.body;

  const ln = await fetchLn(id);

  validateRequestBody(
    ["busId", "routeId", "passengers", "noOfPassengers", "journeyDate"],
    req.body
  );

  if (!Array.isArray(passengers) || passengers.length !== noOfPassengers) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "PASSENGER_COUNT_MISMATCH")
    );
  }

  isValidFutureDate(journeyDate);
  const journeyDateNormalized = normalizeDate(journeyDate);

  const [bus, route] = await Promise.all([
    BusModel.findById(busId).lean(),
    BusRouteModel.findById(routeId).lean(),
  ]);

  if (!bus)
    throw new ApiError(statusCode.NOT_FOUND, translateLn(ln, "BUS_NOT_FOUND"));
  if (!route)
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "ROUTE_NOT_FOUND")
    );

  /* ---------- PRICE ---------- */
  const pricePerSeat = route.pricePerSeat || bus.pricePerSeat || 0;
  const basePrice = pricePerSeat * noOfPassengers;

  /* ---------- COUPON ---------- */
  let discountApplied = 0;
  let finalAmount = basePrice;
  let appliedCoupon = null;

  if (couponCode) {
    const coupon = await CouponModel.findOne({
      couponCode,
      status: "Active",
      serviceType: { $in: ["Bus", "All Services"] },
    });

    if (
      coupon &&
      coupon.expiryDate >= new Date() &&
      basePrice >= coupon.minOrderAmount &&
      !coupon.usageHistory.some(
        (u) => u.userId.toString() === userId.toString()
      )
    ) {
      discountApplied =
        coupon.discountType === "Percentage"
          ? (basePrice * coupon.discountPercentage) / 100
          : coupon.discountAmount;

      finalAmount = Math.max(0, basePrice - discountApplied);
      appliedCoupon = coupon;
    }
  }

  /* ---------- ADMIN COMMISSION ONLY ---------- */
  const commissionConfig = await Commission.findOne({
    serviceType: "bus",
    status: "active",
  }).lean();

  let commission = 0;

  if (commissionConfig) {
    if (commissionConfig.commissionType === "fixed") {
      commission = commissionConfig.commissionRate;
    } else if (commissionConfig.commissionType === "percentage") {
      commission = (finalAmount * commissionConfig.commissionPercentage) / 100;
    }
  }

  commission = Math.min(commission, finalAmount); // safety

  return res.status(statusCode.OK).json({
    success: true,
    message: translateLn(ln, "PRICE_CALCULATED"),
    data: {
      journeyDate: journeyDateNormalized,
      noOfPassengers,
      pricePerSeat,
      basePrice,
      discountApplied,
      finalAmount: finalAmount + commission,
      commission,
      coupon: appliedCoupon
        ? {
            couponId: appliedCoupon._id,
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
});

const getBusBookingDetails = catchAsyncError(async (req, res, next) => {
  const { bookingId } = req.params;
  const ln = req.get("ln") || "en";

  if (!bookingId) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "BOOKING_ID_REQUIRED")
    );
  }

  const booking = await BusBookingModel.findById(bookingId)
    .populate(
      "busId",
      "busName busRegNumber busModelNumber cancellationWindowInHours"
    )
    .populate("bookedBy", "fullName email phoneNumber")
    .populate("routeId", "startLocation endLocation departureTime arrivalTime")
    .lean();

  if (!booking) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "BOOKINGS_NOT_FOUND")
    );
  }

  if (booking?.routeId) {
    booking.routeId.from = booking.routeId.startLocation;
    booking.routeId.to = booking.routeId.endLocation;
    delete booking.routeId.startLocation;
    delete booking.routeId.endLocation;
  }

  const busId = booking?.busId?._id;
  if (busId) {
    const busImagesDoc = await BusImagesModel.findOne(
      { busId },
      { images: 1 }
    ).lean();

    booking.busId.busImages = busImagesDoc?.images?.map((img) => img.url) || [];
  }

  const genderMap = {
    male: { en: "Male", fr: "Masculin" },
    female: { en: "Female", fr: "Féminin" },
    other: { en: "Other", fr: "Autre" },
  };

  if (Array.isArray(booking.passengers)) {
    booking.passengers = booking.passengers.map((passenger) => ({
      ...passenger,
      gender:
        genderMap[passenger.gender?.toLowerCase()]?.[ln] || passenger.gender,
    }));
  }

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

  booking.startDate = startDate;
  booking.endDate = endDate;
  booking.hoursLeft = hoursLeft;
  booking.isCancellable = isCancellable;

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        booking,
        translateLn(ln, "BUS_BOOKINGS_FETCHED")
      )
    );
});

const cancelBusBooking = catchAsyncError(async (req, res, next) => {
  const userId = req.user._id;
  const ln = await fetchLn(userId);

  const { bookingId } = req.params;
  const { cancelReason } = req.body;

  const booking = await BusBookingModel.findById(bookingId).select(
    "paymentStatus status routeId busId journeyDate bookedBy finalAmount "
  );

  if (!booking) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "BOOKINGS_NOT_FOUND")
    );
  }

  if (["Cancelled", "Completed"].includes(booking.status)) {
    const key =
      booking.status === "Cancelled"
        ? "BOOKING_ALREADY_CANCELLED"
        : "BOOKING_ALREADY_COMPLETED";

    throw new ApiError(statusCode.BAD_REQUEST, translateLn(req.ln, key));
  }

  const bus = await BusModel.findById(booking.busId).select(
    "cancellationWindowInHours"
  );
  const route = await BusRouteModel.findById(booking.routeId).select(
    "departureTime"
  );

  if (!bus || !route) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "BUS_OR_ROUTE_NOT_FOUND")
    );
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
        translateLn(ln, "TRANSACTION_NOT_FOUND")
      );
    }
    const busOperatorId = operatorTxn.busOperatorId;

    const userWallet = await WalletModel.findOne({ userId: booking.bookedBy });
    if (!userWallet) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        translateLn(ln, "WALLET_NOT_FOUND")
      );
    }

    userWallet.balance += refundAmount;
    await userWallet.save();

    await TransactionModel.create({
      userId: booking.bookedBy,
      bookingId,
      transactionId: await Transaction.generateTransactionId(),
      type: TransactionTypeEnum.CREDIT,
      amount: refundAmount,
      currency: userWallet.currency,
      description: {
        en: `50% refund for cancelled booking ${bookingId}`,
        fr: `Remboursement de 50 % pour la réservation annulée ${bookingId}`,
      },
      status: PaymentStatusEnum.SUCCESS,
      refund: true,
    });

    const operatorWallet = await WalletModel.findOne({ userId: busOperatorId });
    if (!operatorWallet) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        translateLn(ln, "WALLET_NOT_FOUND")
      );
    }
    if (operatorWallet.balance < refundAmount) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        translateLn(ln, "OPERATOR_INSUFFICIENT_BALANCE")
      );
    }

    operatorWallet.balance -= refundAmount;
    await operatorWallet.save();

    await TransactionModel.create({
      busOperatorId,
      bookingId,
      transactionId: await Transaction.generateTransactionId(),
      type: TransactionTypeEnum.DEBIT,
      amount: refundAmount,
      currency: operatorWallet.currency,
      description: {
        en: `Deduction for 50% refund of cancelled booking ${bookingId}`,
        fr: `Déduction pour le remboursement de 50 % de la réservation annulée ${bookingId}`,
      },
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
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "BOOKED_SEAT_LAYOUT_NOT_FOUND")
    );
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

  await createNotification(
    userId,
    {
      en: "Bus Booking Cancelled",
      fr: "Réservation de bus annulée",
    },
    {
      en: `Your booking ${bookingId} has been cancelled successfully`,
      fr: `Votre réservation ${bookingId} a été annulée avec succès`,
    }
  );

  if (bus?.ownerId) {
    await createNotification(
      bus.ownerId,
      {
        en: "Bus Booking Cancelled",
        fr: "Réservation de bus annulée",
      },
      {
        en: `A booking ${bookingId} has been cancelled by the user`,
        fr: `Une réservation ${bookingId} a été annulée par l'utilisateur`,
      }
    );
  }

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
        translateLn(ln, "BOOKING_CANCELLED")
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
    .json(
      new ApiResponse(statusCode.OK, {}, translateLn(ln, "PAYMENT_SUCCESS"))
    );
});

const UpcomingBusBookings = catchAsyncError(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const userId = req.user._id;
  const ln = await fetchLn(userId);

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
      translateLn(ln, "UPCOMING_BUS_BOOKINGS")
    )
  );
});

const OldBusBookings = catchAsyncError(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const userId = req.user._id;
  const ln = await fetchLn(userId);

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
      translateLn(ln, "OLD_BUS_BOOKINGS")
    )
  );
});

const addTraveller = catchAsyncError(async (req, res) => {
  const userId = req.user._id;
  // const ln = await fetchLn(userId);

  const { name, age, gender, contactNumber, email } = req.body;

  if (!name || !age || !gender) {
    throw new ApiError(statusCode.BAD_REQUEST, "name, age & gender required");
  }

  const traveller = await BusTravellerModel.create({
    userId,
    name,
    age,
    gender,
    email: email || null,
    contactNumber: contactNumber || null,
  });

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, { traveller }, "traveller added"));
});

const getTravellers = catchAsyncError(async (req, res) => {
  const userId = req.user._id;
  // const ln = await fetchLn(userId);

  const travellers = await BusTravellerModel.find({
    userId,
  });

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, { travellers }, "travellers fetched"));
});

const getTravellerById = catchAsyncError(async (req, res) => {
  const travellerId = req.params.travellerId;

  const traveller = await BusTravellerModel.findById(travellerId);

  if (!traveller) {
    throw new ApiError(statusCode.NOT_FOUND, "Traveller not found");
  }

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, traveller, "traveller fetched"));
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
  addTraveller,
  getTravellers,
  getTravellerById,
};

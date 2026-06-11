const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const HotelBooking = require("../../../models/hotel-module/hotel-bookings/hotel-bookings.model");
const Room = require("../../../models/hotel-module/hotel-registration/hotel-room-amenities.model");
const Hotel = require("../../../models/hotel-module/hotel-registration/hotel-details.model");
const individualRoom = require("../../../models/hotel-module/single-room/individual-room.module");
const User = require("../../../models/user-module/users/user.model");
const HotelAddressModel = require("../../../models/hotel-module/hotel-registration/hotel-location.model");
const {
  AddressModel,
} = require("../../../models/global-module/address/address.model");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const HotelBookingModel = require("../../../models/hotel-module/hotel-bookings/hotel-bookings.model");
const WalletModel = require("../../../models/wallet-module/wallets.model");
const TransactionModel = require("../../../models/transaction-module/transaction.model");
const UserModel = require("../../../models/user-module/users/user.model");
const { PaymentStatus } = require("../../../utils/constants/constants");
const ValidateSecurePin = require("../../../utils/services/securePin.services");
const individualRoomModule = require("../../../models/hotel-module/single-room/individual-room.module");
const hotelImagesModel = require("../../../models/hotel-module/hotel-images/hotel-images.model");
const HotelFeedbackModel = require("../../../models/hotel-module/hotel-feedback/hotel-feedback.model");
const HotelPolicyModel = require("../../../models/hotel-module/hotel-registration/hotel-policy.model");
const HotelRoomImagesModel = require("../../../models/hotel-module/hotel-room-images/hotel-room-images.model");
const {
  PaymentStatusEnum,
  TransactionTypeEnum,
  CommissionServiceTypeEnum,
  EntityCodeEnum,
} = require("../../../utils/constants/ENUM");
const UserRecentSearchModel = require("../../../models/user-module/user-recent-search/user-recent-search.model");
const {
  CouponModel,
} = require("../../../models/admin-module/Admin-coupon/adminCouponModel");
const Commission = require("../../../models/admin-module/commission-management/commission.model");
const {
  AdminModel,
} = require("../../../models/admin-module/admin/admin.model");
const generateCustomId = require("../../../utils/customId/generateCustomId");
const HotelManagerModel = require("../../../models/hotel-module/hotel-manager/hotel-manager.model");
const Transaction = require("../../../models/transaction-module/transaction.model");
const {
  createNotification,
} = require("../../global-notification-module/global-notification.controller");

const { translateLn } = require("../../../utils/services/translator.service");

//-------------------- create booking --------------------
const createBooking = catchAsyncError(async (req, res) => {
  const bookedBy = req.user._id;

  let {
    hotelId,
    roomTypeId,
    checkInDate,
    checkOutDate,
    noOfAdults,
    noOfKids,
    noOfRoom,
    couponCode,
    baseAmount,
    commission,
    totalAmount,
    user,
  } = req.body;

  // Convert numbers safely
  noOfRoom = Number(noOfRoom);
  noOfAdults = Number(noOfAdults);
  noOfKids = Number(noOfKids);
  baseAmount = Number(baseAmount);
  commission = Number(commission);
  totalAmount = Number(totalAmount);

  if (
    !hotelId ||
    !roomTypeId ||
    !checkInDate ||
    !checkOutDate ||
    !noOfRoom ||
    baseAmount <= 0 ||
    commission < 0 ||
    totalAmount <= 0
  ) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Missing or invalid booking details."
    );
  }

  const formattedCheckIn = new Date(checkInDate);
  const formattedCheckOut = new Date(checkOutDate);

  const nights = Math.ceil(
    (formattedCheckOut.getTime() - formattedCheckIn.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (formattedCheckIn < today) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Check-in date cannot be in the past."
    );
  }

  if (nights <= 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Check-out must be after check-in"
    );
  }

  const userExists = await User.findById(bookedBy);
  if (!userExists) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found.");
  }

  const hotelExists = await Hotel.findById(hotelId);
  if (!hotelExists) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel not found.");
  }

  // ✅ FIX: Fetch hotel policy & build required times
  const hotelPolicy = await HotelPolicyModel.findOne({ hotelId });

  const checkInTimeStr = hotelPolicy?.checkInTime || "12:00";
  const checkOutTimeStr = hotelPolicy?.checkOutTime || "11:00";

  const checkInTime = new Date(`${checkInDate}T${checkInTimeStr}:00`);
  const checkOutTime = new Date(`${checkOutDate}T${checkOutTimeStr}:00`);

  // ---------------- Coupon Logic (NO commission logic) ----------------
  let finalAmount = totalAmount;
  let appliedCoupon = null;
  let couponMessage = "Booking confirmed.";

  if (couponCode) {
    const coupon = await CouponModel.findOne({
      couponCode,
      status: "Active",
      serviceType: { $in: ["Hotel", "All Services"] },
    });

    if (
      coupon &&
      coupon.expiryDate >= new Date() &&
      totalAmount >= coupon.minOrderAmount &&
      !coupon.usageHistory.some(
        (u) => u.userId.toString() === bookedBy.toString()
      )
    ) {
      if (coupon.discountType === "Percentage") {
        finalAmount =
          totalAmount - (totalAmount * coupon.discountPercentage) / 100;
      } else if (coupon.discountType === "Fixed Amount") {
        finalAmount = totalAmount - coupon.discountAmount;
      }

      if (finalAmount < 0) finalAmount = 0;
      appliedCoupon = coupon;
      couponMessage = `Coupon ${coupon.couponCode} applied successfully.`;
    }
  }

  const overlappingBookings = await HotelBooking.find({
    hotelId,
    roomTypeId,
    status: "Booked",
    paymentStatus: "PAID",
    checkInDate: { $lt: formattedCheckOut },
    checkOutDate: { $gt: formattedCheckIn },
  }).select("noOfRoom");

  const totalBookedRooms = overlappingBookings.reduce(
    (sum, booking) => sum + (booking.noOfRoom || 0),
    0
  );

  const totalRooms = await individualRoom.countDocuments({
    hotelId,
    roomTypeId,
  });

  const availableRooms = totalRooms - totalBookedRooms;

  if (availableRooms < noOfRoom) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Only ${availableRooms} rooms available`
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userWallet = await WalletModel.findOne({ userId: bookedBy }).session(
      session
    );

    if (!userWallet || userWallet.balance < finalAmount) {
      throw new ApiError(statusCode.BAD_REQUEST, "Insufficient wallet balance");
    }

    const bookingId = await generateCustomId(
      EntityCodeEnum.HOTEL_BOOKING,
      "HB"
    );

    // ✅ FIX: pass checkInTime & checkOutTime
    const booking = await HotelBooking.create(
      [
        {
          bookingId,
          bookedBy,
          hotelId,
          roomTypeId,

          checkInDate: formattedCheckIn,
          checkOutDate: formattedCheckOut,
          checkInTime,
          checkOutTime,

          noOfAdults,
          noOfKids,
          noOfRoom,

          baseAmount,
          commissionAmount: commission,
          totalAmount,
          finalAmount,

          couponUsed: appliedCoupon ? appliedCoupon._id : null,
          paymentStatus: "PAID",
          user,
        },
      ],
      { session }
    );

    // Wallet deduction
    userWallet.balance -= finalAmount;
    await userWallet.save({ session });

    // Split
    const operatorShare = Number((finalAmount - commission).toFixed(2));
    const platformFee = commission;

    await WalletModel.findOneAndUpdate(
      { userId: hotelExists.ownerId },
      { $inc: { balance: operatorShare } },
      { session, upsert: true }
    );

    const superAdmin = await AdminModel.findOne({ role: "SuperAdmin" });

    await WalletModel.findOneAndUpdate(
      { userId: superAdmin._id },
      { $inc: { balance: platformFee } },
      { session, upsert: true }
    );

    const hotelManager = await HotelManagerModel.findById(hotelExists.ownerId);

    // Ledger entry
    await TransactionModel.create(
      [
        {
          transactionId: await TransactionModel.generateTransactionId(),
          transactionType: "Hotel Booking",
          bookingId: booking[0].bookingId,
          status: PaymentStatusEnum.SUCCESS,
          totalAmount: finalAmount,
          description: {
            en: `Hotel booking at ${hotelExists.hotelName}`,
            fr: `Réservation d'hôtel à ${hotelExists.hotelName}`,
          },
          platformFee,
          operatorShare,
          entries: [
            {
              entityType: "USER",
              entityId: bookedBy,
              type: "DEBIT",
              amount: finalAmount,
            },
            {
              entityType: "HOTEL",
              entityId: hotelManager?.managerId || hotelExists?.ownerId,
              type: "CREDIT",
              amount: operatorShare,
            },
            {
              entityType: "ADMIN",
              entityId: superAdmin._id,
              type: "CREDIT",
              amount: platformFee,
            },
          ],
          meta: {
            from: {
              name: userExists?.fullName,
              id: userExists?.userId,
            },
            to: {
              name: hotelExists?.hotelName,
              id: hotelManager?.managerId || hotelExists?.ownerId,
            },
            hotel: {
              bookingId: booking[0].bookingId,
            },
          },
        },
      ],
      { session }
    );

    if (appliedCoupon) {
      appliedCoupon.usedCount += 1;
      appliedCoupon.usageHistory.push({ userId: bookedBy, status: "Used" });
      await appliedCoupon.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    try {
      await Promise.all([
        createNotification(
          bookedBy,
          {
            en: "Hotel Booking Confirmed",
            fr: "Réservation d'hôtel confirmée",
          },
          {
            en: `Your booking ${booking[0].bookingId} at ${hotelExists.hotelName} is confirmed`,
            fr: `Votre réservation ${booking[0].bookingId} à ${hotelExists.hotelName} est confirmée`,
          }
        ),

        createNotification(
          hotelExists.ownerId,
          {
            en: "New Hotel Booking",
            fr: "Nouvelle réservation d'hôtel",
          },
          {
            en: `You received a new booking ${booking[0].bookingId}`,
            fr: `Vous avez reçu une nouvelle réservation ${booking[0].bookingId}`,
          }
        ),
      ]);
    } catch (err) {
      console.error("Notification error:", err.message);
    }

    return res
      .status(statusCode.CREATED)
      .json(new ApiResponse(statusCode.CREATED, booking[0], couponMessage));
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

const getTotalAmount = catchAsyncError(async (req, res) => {
  const bookedBy = req.user._id;

  let {
    hotelId,
    roomTypeId,
    checkInDate,
    checkOutDate,
    noOfRoom,
    noOfAdults,
    noOfKids,
    couponCode,
  } = req.body;

  noOfRoom = Number(noOfRoom);
  noOfAdults = Number(noOfAdults);
  noOfKids = Number(noOfKids);

  if (
    !hotelId ||
    !roomTypeId ||
    !checkInDate ||
    !checkOutDate ||
    !noOfRoom ||
    !noOfAdults
  ) {
    throw new ApiError(statusCode.BAD_REQUEST, "Missing required fields.");
  }

  if (noOfRoom <= 0 || noOfAdults <= 0 || noOfKids < 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Invalid number of rooms/adults/kids."
    );
  }

  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const today = new Date().setHours(0, 0, 0, 0);

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid date format.");
  }

  if (checkIn < today) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Check-in date cannot be in the past."
    );
  }

  if (checkOut <= checkIn) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Check-out must be after check-in."
    );
  }

  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  if (nights <= 0 || nights > 30) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid number of nights.");
  }

  const maxAdults = noOfRoom * 2;
  const maxKids = noOfRoom * 2;
  const maxTotal = noOfRoom * 4;

  if (noOfAdults > maxAdults || noOfKids > maxKids) {
    throw new ApiError(statusCode.BAD_REQUEST, "Guest limit exceeded.");
  }

  if (noOfAdults + noOfKids > maxTotal) {
    throw new ApiError(statusCode.BAD_REQUEST, "Guest limit exceeded.");
  }

  const hotelExists = await Hotel.findById(hotelId);
  if (!hotelExists) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel not found.");
  }

  const roomType = await Room.findById(roomTypeId).select("roomPrice");
  if (!roomType || roomType.roomPrice <= 0) {
    throw new ApiError(statusCode.NOT_FOUND, "Invalid room type.");
  }

  // ---------------- PRICING ----------------

  const baseAmount = roomType.roomPrice * noOfRoom * nights;

  // Commission
  const commissionConfig = await Commission.findOne({
    serviceType: "hotel",
    status: "active",
  });

  let commissionAmount = 0;

  if (commissionConfig) {
    if (
      commissionConfig.commissionType === "percentage" &&
      commissionConfig.commissionPercentage
    ) {
      commissionAmount =
        (baseAmount * commissionConfig.commissionPercentage) / 100;
    } else if (
      commissionConfig.commissionType === "fixed" &&
      commissionConfig.commissionRate
    ) {
      commissionAmount = commissionConfig.commissionRate;
    }
  }

  commissionAmount = Number(commissionAmount.toFixed(2));

  const totalAmount = Number((baseAmount + commissionAmount).toFixed(2));

  // ---------------- COUPON ----------------

  let finalAmount = totalAmount;
  let appliedCoupon = null;
  let couponMessage = "Price calculated successfully.";

  if (couponCode) {
    const coupon = await CouponModel.findOne({
      couponCode,
      status: "Active",
      serviceType: { $in: ["Hotel", "All Services"] },
    });

    if (!coupon) {
      couponMessage = "Coupon code is invalid.";
    } else if (coupon.expiryDate < new Date()) {
      couponMessage = "Coupon code has expired.";
    } else if (
      coupon.usageHistory.some(
        (u) => u.userId.toString() === bookedBy.toString()
      )
    ) {
      couponMessage = "You have already used this coupon.";
    } else if (totalAmount < coupon.minOrderAmount) {
      couponMessage = `Coupon valid only above ₹${coupon.minOrderAmount}.`;
    } else {
      if (coupon.discountType === "Percentage") {
        finalAmount =
          totalAmount - (totalAmount * coupon.discountPercentage) / 100;
      } else if (coupon.discountType === "Fixed Amount") {
        finalAmount = totalAmount - coupon.discountAmount;
      }

      if (finalAmount < 0) finalAmount = 0;
      appliedCoupon = coupon;
      couponMessage = `Coupon ${coupon.couponCode} applied successfully.`;
    }
  }

  // ---------------- RESPONSE ----------------
  const isCouponApplied = appliedCoupon !== null;

  const responseStatus = !couponCode || isCouponApplied ? 200 : 801;

  return res.status(responseStatus).json(
    new ApiResponse(
      responseStatus,
      {
        baseAmount,
        commission: commissionAmount,
        totalAmount,
        finalAmount,
        nights,
        noOfRooms: noOfRoom,
        perRoomPrice: roomType.roomPrice,
        priceBreakup: {
          baseAmount,
          commission: commissionAmount,
          totalAmount,
          discount: appliedCoupon ? totalAmount - finalAmount : 0,
          finalAmount,
        },
        appliedCoupon: appliedCoupon ? appliedCoupon.couponCode : null,
        couponMessage,
      },
      couponMessage
    )
  );
});

const payHotelBookingPayment = catchAsyncError(async (req, res, next) => {
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

const getBookings = catchAsyncError(async (req, res) => {
  const { bookingId } = req.query;

  if (!bookingId) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please provide bookingId in query params."
    );
  }

  const booking = await HotelBooking.findById(bookingId)
    .populate({ path: "hotelId", model: Hotel, select: "-__v" })
    .populate({ path: "roomTypeId", model: Room, select: "-__v" })
    .populate({ path: "bookedBy", model: User, select: "-password -__v" })
    .populate({ path: "assignedRooms", model: individualRoom, select: "-__v" });

  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }

  // 🔹 Populate address separately
  const hotelAddress = await HotelAddressModel.findOne({
    hotelId: booking.hotelId?._id,
  })
    .populate("address") // populate actual Address document
    .lean();

  // 🔹 Calculate total nights
  let totalNights = 0;
  if (booking.checkInDate && booking.checkOutDate) {
    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    totalNights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Merge response
  const bookingWithExtras = {
    ...booking.toObject(),
    hotelAddress: hotelAddress?.address || null,
    totalNights,
  };

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        bookingWithExtras,
        "Booking fetched successfully"
      )
    );
});

const getHotelsByLocation = catchAsyncError(async (req, res) => {
  const {
    townCity,
    hotelName,
    requiredRooms,
    checkInDate,
    checkOutDate,
    noOfAdults,
    noOfKids = 0,
    page = 1,
    limit = 10,
  } = req.query;

  const requiredRoomCount = parseInt(requiredRooms);
  const adultsCount = parseInt(noOfAdults);
  const kidsCount = parseInt(noOfKids);
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (isNaN(requiredRoomCount) || requiredRoomCount <= 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "requiredRooms must be a positive integer."
    );
  }

  if (isNaN(adultsCount) || adultsCount <= 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "At least 1 adult is required.");
  }

  if (isNaN(kidsCount) || kidsCount < 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Number of children cannot be negative."
    );
  }

  const totalGuests = adultsCount + kidsCount;
  if (totalGuests > requiredRoomCount * 2) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Total guests exceed maximum allowed occupancy (2 per room)."
    );
  }

  if (!townCity || typeof townCity !== "string") {
    throw new ApiError(statusCode.BAD_REQUEST, "townCity is required.");
  }

  if (!checkInDate || !checkOutDate) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "checkInDate and checkOutDate are required."
    );
  }

  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (checkIn < today) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Check-in date cannot be in the past."
    );
  }

  if (checkOut <= checkIn) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "checkOutDate must be after checkInDate."
    );
  }

  const matchingAddresses = await AddressModel.find({
    townCity: { $regex: townCity, $options: "i" },
  })
    .select("_id")
    .lean();

  if (matchingAddresses.length === 0) {
    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(
          statusCode.OK,
          { total: 0, page: pageNum, limit: limitNum, hotelRoomTypeLayout: [] },
          "No address found for this location."
        )
      );
  }

  const addressIds = matchingAddresses.map((a) => a._id);

  const hotelAddressLinks = await HotelAddressModel.find({
    address: { $in: addressIds },
  })
    .select("hotelId")
    .lean();

  const hotelIds = hotelAddressLinks.map((l) => l.hotelId);

  if (hotelIds.length === 0) {
    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(
          statusCode.OK,
          { total: 0, page: pageNum, limit: limitNum, hotelRoomTypeLayout: [] },
          "No hotels found for this location."
        )
      );
  }

  const hotelFilter = {
    _id: { $in: hotelIds },
  };

  if (hotelName && typeof hotelName === "string") {
    hotelFilter.hotelName = {
      $regex: hotelName.trim(),
      $options: "i",
    };
  }

  const hotels = await Hotel.find(hotelFilter)
    .select("ownerId hotelName rating totalRoom")
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .lean();

  const ownerIds = [...new Set(hotels.map((h) => String(h.ownerId)))];

  const managers = await HotelManagerModel.find({
    _id: { $in: ownerIds },
  })
    .select("_id verificationStatus")
    .lean();

  const managerMap = new Map(
    managers.map((m) => [String(m._id), m.verificationStatus])
  );

  const hotelRoomTypeLayout = await Promise.all(
    hotels.map(async (hotel) => {
      const [
        roomTypes,
        hotelImages,
        hotelAddress,
        hotelPolicies,
        hotelFeedbacks,
      ] = await Promise.all([
        Room.find({ hotelId: hotel._id })
          .select("roomType roomPrice numberOfRoom")
          .lean(),

        hotelImagesModel
          .findOne({ hotelId: hotel._id })
          .select("images")
          .lean(),

        HotelAddressModel.findOne({ hotelId: hotel._id })
          .populate("address", "townCity address landmark")
          .select("address")
          .lean(),

        HotelPolicyModel.findOne({ hotelId: hotel._id })
          .select("amenities checkInTime checkOutTime")
          .lean(),

        HotelFeedbackModel.find({ hotelId: hotel._id }).select("rating").lean(),
      ]);

      const selectedImage = hotelImages?.images?.[0] || null;

      const filteredRoomTypes = await Promise.all(
        roomTypes.map(async (roomType) => {
          const rooms = await individualRoomModule
            .find({ hotelId: hotel._id, roomTypeId: roomType._id })
            .select("_id")
            .lean();

          const totalRooms = rooms.length;

          // const checkInStart = new Date(checkIn);
          // checkInStart.setHours(0, 0, 0, 0);

          // const checkOutEnd = new Date(checkOut);
          // checkOutEnd.setHours(23, 59, 59, 999);

          const checkInStart = new Date(checkIn);
          const checkOutEnd = new Date(checkOut);

          // 🔥 FIXED LOGIC (use booking count instead of assignedRooms)
          const conflictingBookings = await HotelBooking.find({
            hotelId: hotel._id,
            roomTypeId: roomType._id,
            status: "Booked",
            paymentStatus: "PAID",
            checkInDate: { $lt: checkOutEnd },
            checkOutDate: { $gt: checkInStart },
          })
            .select("noOfRoom")
            .lean();

          const totalBookedRooms = conflictingBookings.reduce(
            (sum, booking) => sum + (booking.noOfRoom || 0),
            0
          );

          const availableRooms = totalRooms - totalBookedRooms;
          const bookedRooms = totalBookedRooms;

          if (availableRooms >= requiredRoomCount) {
            return {
              _id: roomType._id,
              roomType: roomType.roomType,
              numberOfRoom: totalRooms,
              roomPrice: roomType.roomPrice,
              availableRooms,
              bookedRooms,
            };
          }
          console.log(
            "Search Range:",
            checkInStart,
            checkOutEnd,
            conflictingBookings
          );

          return null;
        })
      );

      const availableRoomTypes = filteredRoomTypes.filter(Boolean);

      if (availableRoomTypes.length > 0) {
        const isApproved = managerMap.get(String(hotel.ownerId)) === "approved";

        return {
          hotel: {
            hotelId: hotel._id,
            hotelName: hotel.hotelName,
            rating: hotel.rating,
            totalRoom: hotel.totalRoom,
            badge: isApproved,
          },
          hotelImage: selectedImage,
          hotelAddress,
          hotelPolicies,
          hotelFeedbacks,
          roomTypes: availableRoomTypes,
        };
      }

      return null;
    })
  );

  const filteredHotels = hotelRoomTypeLayout.filter(Boolean);

  const responseMessage =
    filteredHotels.length === 0
      ? "No room found"
      : "Hotels retrieved successfully.";

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        total: filteredHotels.length,
        page: pageNum,
        limit: limitNum,
        hotelRoomTypeLayout: filteredHotels,
      },
      responseMessage
    )
  );
});

const getHotelById = catchAsyncError(async (req, res) => {
  const { hotelId } = req.params;
  const { checkInDate, checkOutDate } = req.query;
  const ln = (req.headers["ln"] || "en").toLowerCase();

  if (!hotelId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Hotel ID is required.");
  }

  // Validate dates if provided
  let checkIn, checkOut;
  if (checkInDate || checkOutDate) {
    if (!checkInDate || !checkOutDate) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "Both checkInDate and checkOutDate are required when filtering by dates."
      );
    }

    checkIn = new Date(checkInDate);
    checkOut = new Date(checkOutDate);

    if (checkOut <= checkIn) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "checkOutDate must be after checkInDate."
      );
    }
  }

  // Get basic hotel info
  const hotel = await Hotel.findById(hotelId)
    .select("hotelName rating totalRoom")
    .lean();

  if (!hotel) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel not found.");
  }

  const now = new Date();
  const activeBookings = await HotelBookingModel.find({
    hotelId,
    status: "Booked",
    checkInDate: { $lte: now },
    checkOutDate: { $gte: now },
  })
    .select("noOfRoom")
    .lean();

  const bookedRoomCount = activeBookings.reduce((total, booking) => {
    return total + (booking.noOfRoom || 0);
  }, 0);

  const availableRoomCount = Math.max(
    (hotel.totalRoom || 0) - bookedRoomCount,
    0
  );

  const [hotelImages, hotelAddress, hotelPolicies, hotelFeedbacks, roomTypes] =
    await Promise.all([
      hotelImagesModel.findOne({ hotelId }).select("images").lean(),
      HotelAddressModel.findOne({ hotelId })
        .populate("address", "townCity address landmark")
        .select("address")
        .lean(),
      HotelPolicyModel.findOne({ hotelId })
        .select("amenities checkInTime checkOutTime")
        .lean(),
      HotelFeedbackModel.find({ hotelId }).select("rating").lean(),
      Room.find({ hotelId })
        .select("roomType amenities roomPrice numberOfRoom")
        .lean(),
    ]);

  const allHotelImages = hotelImages?.images || [];

  const roomTypesWithAvailability = await Promise.all(
    roomTypes.map(async (room) => {
      // Room Images
      const roomImageData = await HotelRoomImagesModel.findOne({
        roomId: room._id,
        roomType: room.roomType,
      })
        .select("images")
        .lean();

      const allImages = roomImageData?.images || [];

      const individualRooms = await individualRoomModule
        .find({
          hotelId,
          roomTypeId: room._id,
        })
        .select("_id status")
        .lean();

      const totalRoomsForType = individualRooms.length;

      // const bookedByStatus = new Set(
      //   individualRooms
      //     .filter((r) => r.status === "booked")
      //     .map((r) => r._id.toString())
      // );

      let dateFilter = {};
      if (checkIn && checkOut) {
        dateFilter = {
          checkInDate: { $lt: checkOut },
          checkOutDate: { $gt: checkIn },
        };
      } else {
        const now = new Date();
        dateFilter = {
          checkInDate: { $lte: now },
          checkOutDate: { $gte: now },
        };
      }

      const activeBookingsForType = await HotelBooking.find({
        hotelId,
        roomTypeId: room._id,
        status: "Booked",
        ...dateFilter,
      })
        // .select("assignedRooms")
        .select("noOfRoom")
        .lean();

      // const bookedByAssigned = new Set();
      // activeBookingsForType.forEach((b) => {
      //   b.assignedRooms?.forEach((rid) => bookedByAssigned.add(rid.toString()));
      // });
      const totalBookedForType = activeBookingsForType.reduce(
        (sum, booking) => sum + (booking.noOfRoom || 0),
        0
      );

      const availableRoomsForType = Math.max(
        totalRoomsForType - totalBookedForType,
        0
      );

      return {
        _id: room._id,
        roomType: room.roomType,
        roomPrice: room.roomPrice,
        totalRooms: totalRoomsForType,
        bookedRooms: totalBookedForType,
        availableRooms: availableRoomsForType,
        images: allImages,
        isAvailable: availableRoomsForType > 0,
      };
    })
  );
  const formatAmenityKey = (name) =>
    `AMENITY_${name
      ?.toUpperCase()
      .replace(/WI[-\s]?FI/g, "WIFI") // 👈 FIX WIFI CASE
      .replace(/[^A-Z0-9]/g, "_")
      .replace(/_+/g, "_")}`;

  const translatedAmenities =
    hotelPolicies?.amenities?.map((a) => {
      const key = formatAmenityKey(a.name);
      const translated = translateLn(ln, key);

      return {
        ...a,
        name:
          translated && !translated.startsWith("AMENITY_")
            ? translated
            : a.name, // fallback to DB value
      };
    }) || [];

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        hotel: {
          hotelId,
          hotelName: hotel.hotelName,
          rating: hotel.rating,
          totalRoom: hotel.totalRoom,
        },
        hotelImages: allHotelImages,
        hotelAddress,
        hotelPolicies: {
          ...hotelPolicies?._doc,
          amenities: translatedAmenities,
        },
        hotelFeedbacks,
        roomTypes: roomTypesWithAvailability,
        ...(checkIn && checkOut
          ? {
              dateFilter: {
                checkInDate: checkIn.toISOString(),
                checkOutDate: checkOut.toISOString(),
              },
            }
          : {}),
      },
      translateLn(ln, "HOTEL_FETCHED")
    )
  );
});

const getUpcomingBookings = catchAsyncError(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const userId = req.user._id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const query = {
    bookedBy: userId,
    checkInDate: { $gte: today },
    status: "Booked",
  };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const bookings = await HotelBooking.find(query)
    .sort({ checkInDate: 1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate({
      path: "hotelId",
      model: Hotel,
      select: "-__v -createdAt -updatedAt",
    })
    .populate({
      path: "roomTypeId",
      model: Room,
      select: "-__v -roomDescription",
    })
    .populate({
      path: "bookedBy",
      model: User,
      select: "-__v -password -email -phone",
    })
    .populate({
      path: "assignedRooms",
      model: individualRoom,
      select: "-__v -roomStatus",
    })
    .lean();

  const bookingsWithExtras = await Promise.all(
    bookings.map(async (booking) => {
      const checkIn = new Date(booking.checkInDate);
      const checkOut = new Date(booking.checkOutDate);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

      const now = new Date();
      const diffMs = checkIn - now;
      const hoursLeft = diffMs > 0 ? Math.floor(diffMs / (1000 * 60 * 60)) : 0;
      const isCancellable = hoursLeft >= 24;

      const hotelImages = await hotelImagesModel
        .findOne({ hotelId: booking.hotelId._id })
        .select("images")
        .lean();
      const hotelImage = hotelImages?.images || [];

      return {
        ...booking,
        nights,
        hotelImage,
        isCancellable,
        hoursLeftUntilCheckIn: hoursLeft,
      };
    })
  );

  const totalBookings = await HotelBooking.countDocuments(query);
  const totalPages = Math.ceil(totalBookings / parseInt(limit));

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        totalBookings,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit),
        bookings: bookingsWithExtras,
      },
      "Upcoming bookings fetched successfully"
    )
  );
});
const getPastBookings = catchAsyncError(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const userId = req.user._id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const query = {
    bookedBy: userId,
    checkInDate: { $lt: today },
  };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const bookings = await HotelBooking.find(query)
    .sort({ checkInDate: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate({ path: "hotelId", model: Hotel, select: "-__v" })
    .populate({ path: "roomTypeId", model: Room, select: "-__v" })
    .populate({ path: "bookedBy", model: User, select: "-password -__v" })
    .populate({ path: "assignedRooms", model: individualRoom, select: "-__v" })
    .lean(); // Allow editing results

  const bookingsWithExtras = await Promise.all(
    bookings.map(async (booking) => {
      // Calculate number of nights
      const checkIn = new Date(booking.checkInDate);
      const checkOut = new Date(booking.checkOutDate);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

      // Get hotel images
      const hotelImages = await hotelImagesModel
        .findOne({ hotelId: booking.hotelId._id })
        .select("images")
        .lean();
      const hotelImage = hotelImages?.images || [];

      return {
        ...booking,
        nights,
        hotelImage, // all hotel images
      };
    })
  );

  const totalBookings = await HotelBooking.countDocuments(query);
  const totalPages = Math.ceil(totalBookings / parseInt(limit));

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        totalBookings,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit),
        bookings: bookingsWithExtras,
      },
      "Past bookings fetched successfully"
    )
  );
});

const cancelHotelBooking = catchAsyncError(async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.user._id;
  const { cancelReason } = req.body;

  const booking = await HotelBookingModel.findById(bookingId)
    .populate("assignedRooms")
    .populate("hotelId", "ownerId hotelName");

  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }

  if (booking.bookedBy.toString() !== userId.toString()) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "You can only cancel your own booking"
    );
  }

  if (["Cancelled", "Completed"].includes(booking.status)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Booking is already ${booking.status}`
    );
  }

  const now = Date.now();
  const checkInTime = new Date(booking.checkInDate).getTime();
  const hoursBeforeCheckIn = (checkInTime - now) / (1000 * 60 * 60);

  if (hoursBeforeCheckIn < 24) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "You can only cancel your booking at least 24 hours before the check-in time"
    );
  }

  // Process refund if booking was paid
 if (booking.paymentStatus === "PAID") {
   const refundAmount = booking.finalAmount * 0.5;

   // Get hotel owner directly from booking
   const hotelManagerId = booking.hotelId.ownerId;

   const userWallet = await WalletModel.findOne({ userId });

   if (!userWallet) {
     throw new ApiError(statusCode.NOT_FOUND, "Wallet not found for this user");
   }

   const hotelWallet = await WalletModel.findOne({
     userId: hotelManagerId,
   });

   if (!hotelWallet) {
     throw new ApiError(
       statusCode.NOT_FOUND,
       "Wallet not found for hotel owner"
     );
   }

   // Check hotel has enough balance
   if (hotelWallet.balance < refundAmount) {
     throw new ApiError(
       statusCode.BAD_REQUEST,
       "Insufficient balance in hotel wallet to process refund"
     );
   }

   // Deduct from hotel wallet
   hotelWallet.balance -= refundAmount;
   await hotelWallet.save();

   // Credit user wallet
   userWallet.balance += refundAmount;
   await userWallet.save();

   // Create refund ledger transaction
   await TransactionModel.create({
     transactionId: await TransactionModel.generateTransactionId(),

     transactionType: "HOTEL_REFUND",

     bookingId: booking.bookingId,

     status: PaymentStatusEnum.SUCCESS,

     currency: hotelWallet.currency,

     totalAmount: refundAmount,

     refund: true,

     entries: [
       {
         entityType: "HOTEL",
         entityId: hotelManagerId.toString(),
         name: booking.hotelId.hotelName,
         type: "DEBIT",
         amount: refundAmount,
       },
       {
         entityType: "USER",
         entityId: userId.toString(),
         name: null,
         type: "CREDIT",
         amount: refundAmount,
       },
     ],

     platformFee: 0,
     operatorShare: 0,

     description: {
       en: `50% refund for cancelled hotel booking ${booking.bookingId}`,
       fr: `Remboursement de 50 % pour la réservation d'hôtel annulée ${booking.bookingId}`,
     },

     meta: {
       bookingMongoId: booking._id,
       hotelId: booking.hotelId._id,
       refundPercentage: 50,
       originalAmount: booking.finalAmount,
     },
   });

   booking.paymentStatus = "REFUNDED";
 }

  // ✅ Cancel booking
  booking.status = "Cancelled";
  booking.cancelledBy = "user";
  if (cancelReason) {
    booking.cancelReason = cancelReason;
  }

  // ✅ Update assigned rooms to available
  const roomUpdatePromises = booking.assignedRooms.map((room) => {
    return individualRoom.updateOne(
      { _id: room._id },
      {
        $set: {
          status: "available",
          isAvailable: true,
          bookingReference: null,
          checkInDate: null,
          checkOutDate: null,
          checkInTime: null,
          checkOutTime: null,
        },
      }
    );
  });

  await Promise.all([...roomUpdatePromises, booking.save()]);

  // ✅ Response
  const bookingResponse = {
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
    paymentStatus: booking.paymentStatus,
    totalAmount: booking.totalAmount,
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
        "Booking cancelled and refund processed successfully"
      )
    );
});

const getCancelReasons = (req, res) => {
  try {
    return res.status(200).json({
      statusCode: 200,
      data: {
        cancelReasons: ["Static Price", "Behaviour", "Services", "Others"],
      },
      message: "Cancel reasons fetched successfully",
      success: true,
    });
  } catch (error) {
    console.error("Cancel Reasons Fetch Error:", error);
    return res.status(500).json({
      statusCode: 500,
      data: null,
      message: "Something went wrong",
      success: false,
    });
  }
};

module.exports = {
  createBooking,
  getBookings,
  payHotelBookingPayment,
  getHotelsByLocation,
  getHotelById,
  getTotalAmount,
  getUpcomingBookings,
  getPastBookings,
  getCancelReasons,
  cancelHotelBooking,
};

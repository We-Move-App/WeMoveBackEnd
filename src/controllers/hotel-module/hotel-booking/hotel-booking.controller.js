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

//-------------------- create booking --------------------
const createBooking = catchAsyncError(async (req, res) => {
  const bookedBy = req.user._id;
  let {
    hotelId,
    roomTypeId,
    couponCode,
    checkInDate,
    checkOutDate,
    checkInTime,
    checkOutTime,
    noOfAdults,
    noOfKids,
    noOfRoom,
    user,
  } = req.body;

  if (req.body.totalAmount === undefined || req.body.totalAmount === null) {
    throw new ApiError(statusCode.BAD_REQUEST, "totalAmount is required.");
  }

  let totalAmount = Number(req.body.totalAmount);
  if (isNaN(totalAmount) || totalAmount < 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid totalAmount provided.");
  }

  noOfRoom = Number(noOfRoom);
  noOfAdults = Number(noOfAdults);
  noOfKids = Number(noOfKids);




  if (noOfRoom <= 0 || noOfAdults <= 0 || noOfKids < 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid number of rooms/adults/kids.");
  }


  // Format dates and times
  const formattedCheckIn = new Date(checkInDate);
  const formattedCheckOut = new Date(checkOutDate);
  const hotelPolicy = await HotelPolicyModel.findOne({ hotelId });
  const checkInDateTime = new Date(
    `${checkInDate}T${hotelPolicy?.checkInTime || "12:00"}:00`
  );
  const checkOutDateTime = new Date(
    `${checkOutDate}T${hotelPolicy?.checkOutTime || "11:00"}:00`
  );

  if (
    !bookedBy ||
    !hotelId ||
    !checkInDate ||
    !checkOutDate ||
    !noOfRoom ||
    !roomTypeId
  ) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Missing required booking details."
    );
  }

  // Check if user exists
  const userExists = await User.findById(bookedBy);
  if (!userExists) {
    throw new ApiError(statusCode.NOT_FOUND, "User not registered.");
  }

  // Check if hotel exists
  const hotelExists = await Hotel.findById(hotelId);
  if (!hotelExists) {
    throw new ApiError(statusCode.NOT_FOUND, "Hotel not found.");
  }
  const now = new Date();
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  if (checkIn < now) throw new ApiError(statusCode.BAD_REQUEST, "Check-in cannot be in past");
  if (checkOut <= checkIn) throw new ApiError(statusCode.BAD_REQUEST, "Check-out must be after check-in");

  if (checkIn < now)
    throw new ApiError(statusCode.BAD_REQUEST, "Check-in cannot be in past");
  if (checkOut <= checkIn)
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Check-out must be after check-in"
    );

  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  if (nights <= 0) throw new ApiError(statusCode.BAD_REQUEST, "Stay must be at least 1 night.");
  if (nights > 30) throw new ApiError(statusCode.BAD_REQUEST, "Stay cannot exceed 30 nights.");

  const maxAdults = noOfRoom * 2;
  const maxKids = noOfRoom * 2;
  const maxTotal = noOfRoom * 4;
  const totalGuests = noOfAdults + noOfKids;

  if (noOfAdults > maxAdults) {
    throw new ApiError(statusCode.BAD_REQUEST, `Maximum ${maxAdults} adults allowed for ${noOfRoom} room(s).`);
  }
  if (noOfKids > maxKids) {
    throw new ApiError(statusCode.BAD_REQUEST, `Maximum ${maxKids} children allowed for ${noOfRoom} room(s).`);
  }
  if (totalGuests > maxTotal) {
    throw new ApiError(statusCode.BAD_REQUEST, `Maximum ${maxTotal} total guests allowed for ${noOfRoom} room(s).`);
  }


  const roomType = await Room.findById(roomTypeId).select("roomPrice");
  if (!roomType || !roomType.roomPrice || roomType.roomPrice <= 0) {
    throw new ApiError(statusCode.NOT_FOUND, "Invalid room type or price.");
  }



  const hotelManagerId = hotelExists.ownerId.toString();

  // Find available rooms
  const allHotelRooms = await individualRoom.find({
    hotelId,
    status: "available",
    isAvailable: true,
    roomTypeId,
  });

  // Get overlapping bookings
  const overlappingBookings = await HotelBooking.find({
    hotelId,
    checkInDate: { $lt: formattedCheckOut },
    checkOutDate: { $gt: formattedCheckIn },
    status: { $in: ["Booked"] },
    assignedRooms: { $exists: true, $ne: [] },
  });

  // Collect booked rooms
  const bookedRoomIds = new Set();
  overlappingBookings.forEach((booking) => {
    booking.assignedRooms.forEach((roomId) => {
      bookedRoomIds.add(roomId.toString());
    });
  });

  const trulyAvailableRooms = allHotelRooms.filter(
    (room) => !bookedRoomIds.has(room._id.toString())
  );

  if (trulyAvailableRooms.length < noOfRoom) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Only ${trulyAvailableRooms.length} rooms are available during your selected time. Requested: ${noOfRoom}`
    );
  }
  const room = await Room.findById(roomTypeId);
  if (!room) throw new ApiError(statusCode.NOT_FOUND, "Invalid room type");
  console.log(room.roomPrice)


  console.log("totalAmount===", totalAmount)

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let finalAmount = totalAmount;
    let appliedCoupon = null;
    let couponMessage = null;

    // ✅ Optional coupon logic
    if (couponCode) {
      const currentDate = new Date();
      const coupon = await CouponModel.findOne({
        couponCode,
        status: "Active",
        serviceType: { $in: ["Hotel", "All Services"] },
        startDate: { $lte: currentDate },
        expiryDate: { $gte: currentDate },
        $expr: { $lt: ["$usedCount", "$maxUsage"] },
      });

      if (!coupon) {
        couponMessage = "Invalid or expired coupon.";
      } else {
        const alreadyUsed = coupon.usageHistory.some(
          (u) => u.userId.toString() === bookedBy.toString()
        );

        if (alreadyUsed) {
          couponMessage = "You have already used this coupon.";
        } else if (totalAmount < coupon.minOrderAmount) {
          couponMessage = `Coupon valid only on orders above ₹${coupon.minOrderAmount}.`;
        } else {
          // ✅ Apply discount
          if (coupon.discountType === "Percentage") {
            finalAmount = totalAmount - (totalAmount * coupon.discountPercentage) / 100;
          } else if (coupon.discountType === "Fixed Amount") {
            finalAmount = totalAmount - coupon.discountAmount;
          }
          if (finalAmount < 0) finalAmount = 0;
          appliedCoupon = coupon;
          couponMessage = "Coupon applied successfully.";
        }
      }
    }

    // ✅ Price breakup
    const priceBreakup = {
      noOfRooms: noOfRoom,
      nights,
      // basePricePerRoom: roomType.roomPrice,
      totalAmount,
      discount: appliedCoupon ? totalAmount - finalAmount : 0,
      finalAmount,
    };
    // Step 1: Check wallet balance
    const userWallet = await WalletModel.findOne({ userId: bookedBy }).session(
      session
    );
    console.log(userWallet);
    if (!userWallet || userWallet.balance < finalAmount) {
      await TransactionModel.create(
        [
          {
            transactionId: uuidv4(),
            userId: bookedBy,
            bookingId: null,
            type: "DEBIT",
            status: PaymentStatusEnum.FAILED,
            amount: finalAmount,
            currency: process.env.MOMO_CURRENCY,
            description: "Hotel booking failed - insufficient balance",
          },
        ],
        { session }
      );

      throw new ApiError(statusCode.BAD_REQUEST, "Insufficient wallet balance");
    }
    let paymentStatus = "PENDING";

    if (userWallet.balance >= finalAmount) {
      paymentStatus = "PAID";
    }

    const bookingId = await generateCustomId(
      EntityCodeEnum.HOTEL_BOOKING,
      "HB"
    );
    // Step 2: Create booking
    const booking = await HotelBooking.create(
      [
        {
          bookingId,
          bookedBy,
          roomTypeId,
          hotelId,
          checkInDate: formattedCheckIn,
          checkOutDate: formattedCheckOut,
          assignedRooms: [],
          checkInTime: checkInDateTime,
          checkOutTime: checkOutDateTime,
          totalAmount,
          finalAmount,
          couponUsed: appliedCoupon ? appliedCoupon._id : null,
          paymentStatus,
          noOfAdults,
          noOfKids,
          noOfRoom,
          user,
        },
      ],
      { session }
    );

    const newBooking = booking[0];

    // Step 3: Deduct from user wallet
    userWallet.balance -= finalAmount;
    await userWallet.save({ session });

    // Step 4: Commission split
    const commission = await Commission.findOne({
      serviceType: "hotel",
      status: "active",
    }).session(session);

    let platformFee = 0;
    let operatorShare = totalAmount;

    if (commission) {
      if (
        commission.commissionType === "percentage" &&
        commission.commissionPercentage
      ) {
        platformFee = parseFloat(
          ((totalAmount * commission.commissionPercentage) / 100).toFixed(2)
        );
      } else if (
        commission.commissionType === "fixed" &&
        commission.commissionRate
      ) {
        platformFee = parseFloat(commission.commissionRate.toFixed(2));
      }

      operatorShare = parseFloat((totalAmount - platformFee).toFixed(2));
    }

    await WalletModel.findOneAndUpdate(
      { userId: hotelManagerId },
      { $inc: { balance: operatorShare } },
      { session, new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const superAdmin = await AdminModel.findOne({ role: "SuperAdmin" });
    if (!superAdmin) {
      console.log("Super Admin not found adding to default wallet ADM001");
    }

    const adminId = superAdmin?._id || "ADM001";

    await WalletModel.findOneAndUpdate(
      { userId: adminId },
      { $inc: { balance: platformFee } },
      { session, new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Step 5: Record transactions
    await TransactionModel.insertMany(
      [
        {
          transactionId: uuidv4(),
          userId: bookedBy,
          bookingId: newBooking._id,
          type: "DEBIT",
          status: PaymentStatusEnum.SUCCESS,
          amount: finalAmount,
          currency: process.env.MOMO_CURRENCY,
          description: `Hotel booking ${hotelExists.hotelName}`,
        },
        {
          transactionId: uuidv4(),
          hotelManagerId,
          bookingId: newBooking._id,
          type: "CREDIT",
          status: PaymentStatusEnum.SUCCESS,
          amount: operatorShare,
          currency: process.env.MOMO_CURRENCY,
          description: "Earnings from hotel booking",
          operatorShare,
        },
        {
          transactionId: uuidv4(),
          adminId: adminId,
          bookingId: newBooking._id,
          type: "CREDIT",
          status: PaymentStatusEnum.SUCCESS,
          amount: platformFee,
          currency: process.env.MOMO_CURRENCY,
          description: "Commission from hotel booking",
          platformFee,
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

    return res.status(statusCode.CREATED).json(
      new ApiResponse(
        statusCode.CREATED,
        {
          ...newBooking.toObject(),
          priceBreakup,
        },

        "Hotel booking created successfully"
      )
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

const getTotalAmount = catchAsyncError(async (req, res) => {
  const bookedBy = req.user._id;
  console.log(bookedBy)
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

  // ✅ Convert numbers safely
  noOfRoom = Number(noOfRoom);
  noOfAdults = Number(noOfAdults);
  noOfKids = Number(noOfKids);

  // ✅ Required field validation
  if (!hotelId || !roomTypeId || !checkInDate || !checkOutDate || !noOfRoom || !noOfAdults || !bookedBy) {
    throw new ApiError(statusCode.BAD_REQUEST, "Missing required fields.");
  }


  if (noOfRoom <= 0 || noOfAdults <= 0 || noOfKids < 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid number of rooms/adults/kids.");
  }

  // ✅ Date parsing
  const now = new Date();
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Invalid date format. Please use YYYY-MM-DD."
    );
  }

  // ✅ Check-in cannot be in the past
  if (checkIn < now.setHours(0, 0, 0, 0)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Check-in cannot be in the past."
    );
  }

  // ✅ Checkout must be after check-in
  if (checkOut <= checkIn) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Check-out must be after check-in date."
    );
  }


  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  if (nights <= 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Stay must be at least 1 night."
    );
  }
  if (nights > 30) {
    throw new ApiError(statusCode.BAD_REQUEST, "Stay cannot exceed 30 nights.");
  }

  // ✅ Guest validation
  const maxAdults = noOfRoom * 2;
  const maxKids = noOfRoom * 2;
  const maxTotal = noOfRoom * 4;
  const totalGuests = noOfAdults + noOfKids;

  if (noOfAdults > maxAdults) {
    throw new ApiError(statusCode.BAD_REQUEST, `Maximum ${maxAdults} adults allowed for ${noOfRoom} room(s).`);
  }
  if (noOfKids > maxKids) {
    throw new ApiError(statusCode.BAD_REQUEST, `Maximum ${maxKids} children allowed for ${noOfRoom} room(s).`);
  }
  if (totalGuests > maxTotal) {
    throw new ApiError(statusCode.BAD_REQUEST, `Maximum ${maxTotal} total guests allowed for ${noOfRoom} room(s).`);
  }
  const hotelExists = await Hotel.findById(hotelId);
  if (!hotelExists) throw new ApiError(statusCode.NOT_FOUND, "Hotel not found.");

  const roomType = await Room.findById(roomTypeId).select("roomPrice");
  if (!roomType || !roomType.roomPrice || roomType.roomPrice <= 0) {
    throw new ApiError(statusCode.NOT_FOUND, "Invalid room type or price.");
  }

  // ✅ Base total calculation
  const totalAmount = roomType.roomPrice * noOfRoom * nights;
  let finalAmount = totalAmount;
  let appliedCoupon = null;
  let couponMessage = null;

  // ✅ Optional coupon logic
  if (couponCode) {
    const currentDate = new Date();
    const coupon = await CouponModel.findOne({
      couponCode,
      status: "Active",
      serviceType: { $in: ["Hotel", "All Services"] },
      startDate: { $lte: currentDate },
      expiryDate: { $gte: currentDate },
      $expr: { $lt: ["$usedCount", "$maxUsage"] },
    });

    if (!coupon) {
      couponMessage = "Invalid or expired coupon.";
    } else {
      const alreadyUsed = coupon.usageHistory.some(
        (u) => u.userId.toString() === bookedBy.toString()
      );

      if (alreadyUsed) {
        couponMessage = "You have already used this coupon.";
      } else if (totalAmount < coupon.minOrderAmount) {
        couponMessage = `Coupon valid only on orders above ₹${coupon.minOrderAmount}.`;
      } else {
        // ✅ Apply discount
        if (coupon.discountType === "Percentage") {
          finalAmount = totalAmount - (totalAmount * coupon.discountPercentage) / 100;
        } else if (coupon.discountType === "Fixed Amount") {
          finalAmount = totalAmount - coupon.discountAmount;
        }
        if (finalAmount < 0) finalAmount = 0;
        appliedCoupon = coupon;
        couponMessage = "Coupon applied successfully.";
      }
    }
  }

  // ✅ Price breakup
  const priceBreakup = {
    noOfRooms: noOfRoom,
    nights,
    basePricePerRoom: roomType.roomPrice,
    totalAmount,
    discount: appliedCoupon ? totalAmount - finalAmount : 0,
    finalAmount,
  };

  // ✅ Response
  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        totalAmount,
        nights,
        noOfRooms: noOfRoom,
        perRoomPrice: roomType.roomPrice,
        adults: noOfAdults,
        children: noOfKids,
        priceBreakup,
        appliedCoupon: appliedCoupon ? appliedCoupon.couponCode : null,
        couponMessage,
      },
      "Price calculated successfully"
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
  const { bookingId, hotelId, page = 1, limit = 10 } = req.query;

  const query = {};

  if (bookingId) {
    query._id = bookingId;
  } else if (hotelId) {
    query.hotelId = hotelId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (roomTypeId) {
      query.roomTypeId = roomTypeId;
    }

    if (userId) {
      query.bookedBy = userId;
    }
  } else {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please provide bookingId or hotelId in query params."
    );
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const bookings = await HotelBooking.find(query)

    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate({ path: "hotelId", model: Hotel, select: "-__v" })
    .populate({ path: "roomTypeId", model: Room, select: "-__v" })
    .populate({ path: "bookedBy", model: User, select: "-password -__v" })
    .populate({ path: "assignedRooms", model: individualRoom, select: "-__v" });

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
        bookings,
      },
      "Booking(s) fetched successfully"
    )
  );
});

const getHotelsByLocation = catchAsyncError(async (req, res) => {
  const {
    townCity,
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

  // 3. Children must be >= 0
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

  if (!requiredRoomCount) {
    throw new ApiError(statusCode.BAD_REQUEST, "requiredRooms is required.");
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

  // Prevent searching in the past
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

  const addressIds = matchingAddresses.map((addr) => addr._id);

  const hotelAddressLinks = await HotelAddressModel.find({
    address: { $in: addressIds },
  })
    .select("hotelId")
    .lean();

  const hotelIds = hotelAddressLinks.map((link) => link.hotelId);

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

  const hotels = await Hotel.find({ _id: { $in: hotelIds } })
    .select("hotelName rating  totalRoom")
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .lean();

  const hotelRoomTypeLayout = await Promise.all(
    hotels.map(async (hotel) => {
      const [
        roomTypes,
        hotelImages,
        hotelAddress,
        hotelPolicies,
        HotelFeedbacks,
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
          .select("amenities checkInTime checkOutTime ")
          .lean(),
        HotelFeedbackModel.find({ hotelId: hotel._id }).select("rating").lean(),
      ]);

      const selectedImage = hotelImages?.images?.[0] || null;
      const filteredRoomTypes = await Promise.all(
        roomTypes.map(async (roomType) => {
          const rooms = await individualRoomModule
            .find({
              hotelId: hotel._id,
              roomTypeId: roomType._id,
            })
            .select("_id")
            .lean();

          const roomIds = rooms.map((r) => r._id);

          const conflictingBookings = await HotelBooking.find({
            roomId: { $in: roomIds },
            checkInDate: { $lt: checkOut },
            checkOutDate: { $gt: checkIn },
          })
            .select("roomId")
            .lean();

          const bookedRoomIds = new Set(
            conflictingBookings.map((b) => b.roomId.toString())
          );
          const availableRooms = roomIds.filter(
            (id) => !bookedRoomIds.has(id.toString())
          ).length;

          if (availableRooms >= requiredRoomCount) {
            return {
              _id: roomType._id,
              roomType: roomType.roomType,
              numberOfRoom: roomType.numberOfRoom,
              roomPrice: roomType.roomPrice,
              availableRooms,
            };
          } else {
            return null;
          }
        })
      );

      const availableRoomTypes = filteredRoomTypes.filter(Boolean);

      if (availableRoomTypes.length > 0) {
        return {
          hotel: {
            hotelId: hotel._id,
            hotelName: hotel.hotelName,
            rating: hotel.rating,
            totalRoom: hotel.totalRoom,
          },
          hotelImage: selectedImage,
          hotelAddress,
          hotelPolicies,
          hotelFeedbacks: HotelFeedbacks,
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

  if (filteredHotels.length > 0) {
    const firstHotelName = filteredHotels[0]?.hotel?.hotelName || null;

    // Check if a recent search for this user and townCity already exists
    const existingSearch = await UserRecentSearchModel.findOne({
      user: req.user._id,
      category: "hotel",
      "searchDetails.hotel.location.address": townCity, // match city
    });

    if (!existingSearch) {
      try {
        await UserRecentSearchModel.create({
          user: req.user._id,
          category: "hotel",
          searchDetails: {
            hotel: {
              location: {
                hotelName: firstHotelName,
                address: townCity,
              },
              checkInDate: new Date(checkInDate),
              checkOutDate: new Date(checkOutDate),
              requiredRooms: parseInt(requiredRooms),
            },
          },
          searchTime: new Date(),
        });

        console.log("Recent hotel search saved successfully");
      } catch (err) {
        console.error("Error saving recent search:", err);
      }
    } else {
      console.log("Search for this location already exists. Skipping save.");
    }
  }

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

//-------------------- get hotel by id --------------------
const getHotelById = catchAsyncError(async (req, res) => {
  const { hotelId } = req.params;
  const { checkInDate, checkOutDate } = req.query;

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
        .select("roomType  amenities roomPrice  numberOfRoom")
        .lean(),
    ]);
  const allHotelImages = hotelImages?.images || [];

  // Process room types with availability check if dates provided
  const roomTypesWithAvailability = await Promise.all(
    roomTypes.map(async (room) => {
      const roomImageData = await HotelRoomImagesModel.findOne({
        roomId: room._id,
        roomType: room.roomType,
      })
        .select("images")
        .lean();

      const allImages = roomImageData?.images || [];

      // If dates provided, check availability
      let availableRooms = room.numberOfRoom;
      if (checkIn && checkOut) {
        const individualRooms = await individualRoomModule
          .find({ hotelId, roomTypeId: room._id })
          .select("_id")
          .lean();

        const roomIds = individualRooms.map((r) => r._id);

        if (roomIds.length > 0) {
          const conflictingBookings = await HotelBooking.find({
            roomId: { $in: roomIds },
            checkInDate: { $lt: checkOut },
            checkOutDate: { $gt: checkIn },
          })
            .select("roomId")
            .lean();

          const bookedRoomIds = new Set(
            conflictingBookings.map((b) => b.roomId.toString())
          );
          availableRooms = roomIds.filter(
            (id) => !bookedRoomIds.has(id.toString())
          ).length;
        } else {
          availableRooms = 0;
        }
      }

      return {
        _id: room._id,
        roomType: room.roomType,
        roomPrice: room.roomPrice,
        totalRooms: Number(room.numberOfRoom),
        availableRooms: Number(availableRooms),
        images: allImages,
        isAvailable: availableRooms > 0,
      };
    })
  );

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
        hotelPolicies,
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
      "Hotel details fetched successfully."
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
    const refundAmount = booking.totalAmount * 0.5;

    const operatorTxn = await TransactionModel.findOne({
      bookingId,
      hotelManagerId: { $ne: null },
    }).select("hotelManagerId currency amount");

    if (!operatorTxn) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        "Transaction not found for this booking"
      );
    }

    const hotelManagerId = operatorTxn.hotelManagerId;

    const userWallet = await WalletModel.findOne({ userId });
    if (!userWallet) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        "Wallet not found for this user"
      );
    }

    const hotelWallet = await WalletModel.findOne({ userId: hotelManagerId });
    if (!hotelWallet) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        "Wallet not found for hotel owner"
      );
    }

    // ✅ First: Deduct from hotel wallet
    if (hotelWallet.balance < refundAmount) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "Insufficient balance in hotel wallet to process refund"
      );
    }

    hotelWallet.balance -= refundAmount;
    await hotelWallet.save();

    await TransactionModel.create({
      userId: hotelManagerId,
      hotelManagerId,
      bookingId,
      transactionId: uuidv4(),
      type: TransactionTypeEnum.DEBIT,
      amount: refundAmount,
      currency: hotelWallet.currency,
      description: `Deduction for 50% refund of cancelled hotel booking ${bookingId}`,
      status: PaymentStatusEnum.SUCCESS,
      refund: true,
    });

    // ✅ Then: Credit to user wallet
    userWallet.balance += refundAmount;
    await userWallet.save();

    await TransactionModel.create({
      userId,
      bookingId,
      transactionId: uuidv4(),
      type: TransactionTypeEnum.CREDIT,
      amount: refundAmount,
      currency: userWallet.currency,
      description: `50% refund for cancelled hotel booking ${bookingId}`,
      status: PaymentStatusEnum.SUCCESS,
      refund: true,
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

const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const statusCode = require("../../utils/constants/statusCode");
const {
  getDistanceAndDuration,
} = require("../../utils/map/get-distance-and-duration");
const ApiError = require("../../utils/response/ApiError");
const ApiResponse = require("../../utils/response/ApiResponse");
const catchAsyncError = require("../../utils/response/catchAsyncError");
const vehicleConfig = require("../../utils/config/vehicleConfig.json");
const RideBookingDetail = require("../../models/new-driver-module/booking-details/booking-details.model");
const DriverLocation = require("../../models/new-driver-module/location/driver-location.model");
const TransactionModel = require("../../models/transaction-module/transaction.model");
const {
  RideBookStatusEnum,
  EntityCodeEnum,
  LocationStatusEnum,
  DriverDocEnum,
  PaymentStatusEnum,
  BookCancelledByEnum,
  VehicleTypeEnum,
  TransactionTypeEnum,
} = require("../../utils/constants/ENUM");
const WalletModel = require("../../models/wallet-module/wallets.model");
const generateCustomId = require("../../utils/customId/generateCustomId");
const findNearbyDrivers = require("../../utils/map/find-near-by-drivers");
const { getOtp } = require("../../utils/otpService/otpService");
const { assignRideToDrivers } = require("../../socket/handlers/rideHandler");
const UserModel = require("../../models/user-module/users/user.model");
const DriverDocDetails = require("../../models/new-driver-module/documents/driver-documents.model");
const {
  decodeAccessToken,
} = require("../../utils/jwtToken/customTokenService");
const { getIO } = require("../../socket/index");
const DriverBasicDetails = require("../../models/new-driver-module/basic-details/basic-details.model");
const DriverVehicleDetails = require("../../models/new-driver-module/vehicle-details/vehicle-details.model");
const Commission = require("../../models/admin-module/commission-management/commission.model");
const { AdminModel } = require("../../models/admin-module/admin/admin.model");
const Transaction = require("../../models/transaction-module/transaction.model");
const { fetchLn } = require("../../utils/services/user.services");
const { translateLn } = require("../../utils/services/translator.service");

function calculateFare(type, distanceInKm, durationInMin) {
  const config = vehicleConfig[type];
  if (!config) {
    throw new Error(`Invalid vehicle type: ${type}`);
  }

  const fare = Math.round(
    config.baseFare +
      distanceInKm * config.perKm +
      durationInMin * config.perMin
  );

  return {
    id: config.id,
    text: config.text,
    logo: config.logo,
    fare,
    estimatedArrivalInMin: 5,
  };
}

const estimateRide = catchAsyncError(async (req, res) => {
  const { pickup, drop } = req.body;
  const vehicleType = req.query.vehicleType?.toLowerCase();

  if (!vehicleType || !["bike", "taxi"].includes(vehicleType)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Invalid or missing vehicleType. Must be 'bike' or 'taxi'"
    );
  }

  if (!pickup?.lat || !pickup?.lng || !drop?.lat || !drop?.lng) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Pickup and drop coordinates are required"
    );
  }

  const pickupCoords = { lat: pickup.lat, lng: pickup.lng };
  const dropCoords = { lat: drop.lat, lng: drop.lng };

  let metrics;
  if (vehicleType === "bike") {
    try {
      metrics = await getDistanceAndDuration(
        pickupCoords,
        dropCoords,
        "bicycling"
      );
    } catch (err) {
      console.warn("Bicycling mode failed, falling back to driving.");
      metrics = await getDistanceAndDuration(
        pickupCoords,
        dropCoords,
        "driving"
      );
    }
  } else {
    metrics = await getDistanceAndDuration(pickupCoords, dropCoords, "driving");
  }

  const estimate = calculateFare(
    vehicleType.toUpperCase(),
    metrics.distanceInKm,
    metrics.durationInMin
  );

  const rideOptions = [
    {
      _id: estimate.id || "001", // fallback if no ID from calculateFare
      vehicleType: vehicleType,
      category: estimate.text || `${vehicleType} Ride`,
      estimatedFare: estimate.fare,
      estimatedDistance: `${metrics.distanceInKm} km`,
      estimatedDuration: `${metrics.durationInMin} min`,
      estimatedPickupTime: `${estimate.estimatedArrivalInMin || 5} min`,
      image: estimate.logo || null,
      description: estimate.description || `${vehicleType} ride estimated`,
    },
  ];

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        rideOptions,
        `${vehicleType} ride estimated successfully`
      )
    );
});

const requestRide = async (req, res, next) => {
  console.log("Api Called");

  try {
    // ----------------- Step 1: Token Validation -----------------
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new ApiError(
        statusCode.UNAUTHORIZED,
        "Access token is missing or invalid"
      );
    }

    const jwtToken = authHeader.split(" ")[1];
    const decoded = decodeAccessToken(jwtToken);

    const userId = decoded?._id;
    const phoneNumber = decoded?.phoneNumber;

    if (!userId || !phoneNumber) {
      throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
    }

    // ----------------- Step 2: User Exists Check -----------------
    const userExists = await UserModel.findById(userId);
    if (!userExists) {
      throw new ApiError(statusCode.NOT_FOUND, "User not found");
    }

    // ----------------- Step 3: Request Body Validation -----------------
    const { pickup, drop, vehicle } = req.body;
    console.log("pickup", pickup);
    console.log("drop", drop);

    if (!pickup?.lat || !pickup?.lng || !pickup?.address) {
      throw new ApiError(statusCode.BAD_REQUEST, "Pickup details required");
    }
    if (!drop?.lat || !drop?.lng || !drop?.address) {
      throw new ApiError(statusCode.BAD_REQUEST, "Drop details required");
    }
    if (!vehicle?._id || !vehicle?.vehicleType) {
      throw new ApiError(statusCode.BAD_REQUEST, "Vehicle details required");
    }

    // ----------------- Step 4: Create Booking -----------------
    const bookingId = await generateCustomId(EntityCodeEnum.RIDES, "R");
    const otp = getOtp();

    const newBooking = await RideBookingDetail.create({
      bookingId,
      userId,
      pickupLocation: {
        address: pickup.address,
        location: { type: "Point", coordinates: [pickup.lng, pickup.lat] },
      },
      dropLocation: {
        address: drop.address,
        location: { type: "Point", coordinates: [drop.lng, drop.lat] },
      },
      fare: vehicle.estimatedFare,
      vehicleType: vehicle.vehicleType,
      category: vehicle.category,
      rideStatus: RideBookStatusEnum.REQUESTED,
      expectedOtp: otp,
      distanceInKm: parseFloat(vehicle.estimatedDistance),
      durationInMin: parseInt(vehicle.estimatedDuration),
      timestamps: { requestedAt: new Date() },
    });

    const responseData = {
      _id: newBooking.bookingId,
      user: newBooking.userId,
      driver: newBooking.driverId || null,
      vehicleType: newBooking.vehicleType,
      pickupLocation: {
        address: newBooking.pickupLocation.address,
        coordinates: [
          ...(newBooking.pickupLocation?.location?.coordinates ?? []),
        ].reverse(),
      },
      dropLocation: {
        address: newBooking.dropLocation.address,
        coordinates: [
          ...(newBooking.dropLocation?.location?.coordinates ?? []),
        ].reverse(),
      },
      estimatedFare: newBooking.fare,
      otp: newBooking.expectedOtp,
      otpVerified: newBooking.otpVerified,
    };

    // ----------------- Step 5: Respond Immediately -----------------
    res
      .status(statusCode.CREATED)
      .json(
        new ApiResponse(
          statusCode.CREATED,
          responseData,
          "Ride requested successfully"
        )
      );

    // ----------------- Step 6: Run Background Assignment -----------------
    process.nextTick(async () => {
      try {
        // Step 6.1: Log all online drivers
        const onlineDrivers = await DriverLocation.find({
          status: LocationStatusEnum.ONLINE,
        }).select("_id location");

        console.log(`Total online drivers: ${onlineDrivers.length}`);
        onlineDrivers.forEach((driver) => {
          // console.log(driver)
          console.log(
            `Driver ${driver.driverId} Location:`,
            driver.location?.coordinates || "N/A"
          );
        });

        // Step 6.2: Find available drivers near pickup
        const pickupCoords = [pickup.lat, pickup.lng];
        const nearbyDrivers = await findNearbyDrivers(
          pickupCoords,
          vehicle.vehicleType
        );

        console.log(`Available nearby drivers: ${nearbyDrivers.length}`);
        nearbyDrivers.forEach((driver) => {
          console.log(
            `Available Driver ${driver.driverId} Location:`,
            driver.location?.coordinates || "N/A"
          );
        });

        // Step 6.3: Assign or cancel
        // inside requestRide background process:
        if (nearbyDrivers.length > 0) {
          const io = getIO();
          assignRideToDrivers(
            io,
            bookingId,
            nearbyDrivers,
            newBooking,
            vehicle,
            otp, // OTP
            0, // start batch index
            3 // batch size
          );
        } else {
          await RideBookingDetail.findOneAndUpdate(
            { bookingId },
            {
              rideStatus: RideBookStatusEnum.CANCELLED,
              cancelledBy: BookCancelledByEnum.SYSTEM,
              reasonToCancel: "No nearby drivers",
              "timestamps.cancelledAt": new Date(),
            }
          );
          const io = getIO();
          io.to(userId).emit("ride:cancelled", {
            bookingId,
            reason: "No nearby drivers",
          });
        }
      } catch (err) {
        console.error("Error in background driver assignment:", err);
      }
    });
  } catch (err) {
    next(err);
  }
};

const cancelRideByUser = catchAsyncError(async (req, res) => {
  const { bookingId } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const jwtToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(jwtToken);
  const userId = decoded?._id;

  // 1. Find the booking
  const booking = await RideBookingDetail.findOne({
    bookingId,
    userId,
    rideStatus: {
      $in: [
        RideBookStatusEnum.REQUESTED,
        RideBookStatusEnum.ACCEPTED,
        RideBookStatusEnum.ARRIVED,
      ],
    },
  });

  if (!booking) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "Active ride not found or already completed/cancelled"
    );
  }

  // 2. Update booking status
  const updatedBooking = await RideBookingDetail.findOneAndUpdate(
    { bookingId },
    {
      rideStatus: RideBookStatusEnum.CANCELLED,
      cancelledBy: "USER",
      reasonToCancel: "Cancelled by user",
      "timestamps.cancelledAt": new Date(),
    },
    { new: true }
  );

  // 3. Notify driver if ride was accepted
  if (booking.driverId) {
    const io = getIO();
    io.to(booking.driverId).emit("ride:cancelled", {
      bookingId,
      reason: "Cancelled by user",
    });
  }

  // 4. Respond to user
  res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { bookingId },
        "Ride cancelled successfully"
      )
    );
});

const getUserDetailsByRideId = catchAsyncError(async (req, res, next) => {
  const rideId = req.params.rideId;

  const booking = await RideBookingDetail.findOne({ bookingId: rideId });

  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }

  const user = await UserModel.findById(booking.userId).lean();

  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { basicDetails: user },
        "User details found successfully"
      )
    );
});

const getDriverDetailsByRideId = catchAsyncError(async (req, res, next) => {
  const rideId = req.params.rideId;

  const booking = await RideBookingDetail.findOne({ bookingId: rideId });

  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }

  const driver = await DriverBasicDetails.findOne({
    driverId: booking.driverId,
  });

  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  const vehicle = await DriverVehicleDetails.findOne({
    driverId: booking.driverId,
  });

  if (!vehicle) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "Vehicle not found for this driver"
    );
  }

  const driverDocument = await DriverDocDetails.findOne({
    driverId: booking.driverId,
  });

  const driverLocation = await DriverLocation.findOne({
    driverId: booking.driverId,
  });

  const avatarUrl =
    driverDocument?.documents?.find(
      (doc) => doc.documentType === DriverDocEnum.AVATAR
    )?.fileUrl || null;

  const vehiclePhotoUrl =
    driverDocument?.documents?.find(
      (doc) => doc.documentType === DriverDocEnum.VEHICLEPHOTO
    )?.fileUrl || null;

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        driver: {
          ...driver.toObject(),
          driverImage: avatarUrl,
          driverLocation: [
            ...(driverLocation?.location?.coordinates ?? []),
          ].reverse(),
        },
        vehicle: {
          ...vehicle.toObject(),
          vehicleImage: vehiclePhotoUrl,
        },
      },
      "User details found successfully"
    )
  );
});

const verifyOtp = catchAsyncError(async (req, res, next) => {
  const rideId = req.params.rideId;
  const { otp } = req.body;
  const ln = req.get("ln") || "en";

  const booking = await RideBookingDetail.findOne({ bookingId: rideId });

  if (!booking) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "BOOKING_NOT_FOUND")
    );
  }

  if (booking.expectedOtp === otp) {
    booking.otpVerified = true;
    booking.timestamps.arrivedAt = Date.now();
    booking.timestamps.pickupAt = Date.now();
    await booking.save();

    const io = req.io || getIO();
    if (!io) {
      throw new ApiError(
        statusCode.INTERNAL_SERVER_ERROR,
        "Socket.IO not initialized"
      );
    }

    io.to(booking.userId.toString()).emit("ride:started", {
      rideId: booking.bookingId,
      driverId: booking.driverId,
      isRideStarted: true,
      rideStatus: RideBookStatusEnum.ONGOING,
    });
  } else {
    throw new ApiError(statusCode.BAD_REQUEST, translateLn(ln, "INVALID_OTP"));
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        true,
        translateLn(ln, "OTP_VERIFIED_SUCCESSFULLY")
      )
    );
});

const completeRide = catchAsyncError(async (req, res, next) => {
  const rideId = req.params.rideId;
  const ln = req.get("ln") || "en";

  const booking = await RideBookingDetail.findOne({ bookingId: rideId });
  if (!booking) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "BOOKING_NOT_FOUND")
    );
  }

  if (booking.rideStatus === RideBookStatusEnum.COMPLETED) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "RIDE_ALREADY_COMPLETED")
    );
  }

  const userExists = await UserModel.findById(booking.userId);
  const driverExist = await DriverBasicDetails.findOne({
    driverId: booking.driverId,
  });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // --- Step 1: Wallet deduction for user ---
    const userWallet = await WalletModel.findOne({
      userId: booking.userId,
    }).session(session);

    if (!userWallet || userWallet.balance < booking.fare) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        translateLn(ln, "INSUFFICIENT_BALANCEs")
      );
    }

    userWallet.balance -= booking.fare;
    await userWallet.save({ session });

    // --- Step 2: Commission split ---
    let platformFee = 0;
    let driverShare = booking.fare;

    console.log("booking.fare", booking.fare);

    const commission = await Commission.findOne({
      serviceType: booking.vehicleType,
      status: "active",
    });

    if (commission) {
      if (commission.commissionType === "percentage") {
        platformFee = parseFloat(
          ((booking.fare * commission.commissionPercentage) / 100).toFixed(2)
        );
      } else if (commission.commissionType === "flat") {
        platformFee = commission.commissionRate || 0;
      }
      driverShare = parseFloat((booking.fare - platformFee).toFixed(2));
    }

    await WalletModel.findOneAndUpdate(
      { userId: booking.driverId },
      { $inc: { balance: driverShare } },
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

    console.log("adminId", adminId);

    // --- Step 3: Create transactions (updated for new ledger model) ---
    const round2 = (n) => Number(Number(n).toFixed(2));

    const totalFare = round2(booking.fare);
    platformFee = round2(platformFee);
    driverShare = round2(driverShare);

    // make sure debit == credit exactly (avoid validator failure)
    const diff = round2(totalFare - round2(platformFee + driverShare));
    if (diff !== 0) driverShare = round2(driverShare + diff);

    await TransactionModel.create(
      [
        {
          transactionId: await TransactionModel.generateTransactionId(),
          transactionType: "Ride Booking",
          momoRefId: null,
          bookingId: booking.bookingId,
          status: PaymentStatusEnum.SUCCESS,
          currency: process.env.MOMO_CURRENCY,
          totalAmount: totalFare,
          description: {
            en: `${booking.vehicleType} ride from ${booking.pickupLocation.address} → ${booking.dropLocation.address}`,
            fr: `${booking.vehicleType} trajet de ${booking.pickupLocation.address} → ${booking.dropLocation.address}`,
          },
          platformFee: platformFee,
          operatorShare: driverShare,
          entries: [
            {
              entityType: "USER",
              entityId: booking.userId,
              name: userExists?.fullName || null,
              type: "DEBIT",
              amount: totalFare,
            },
            {
              entityType: "DRIVER",
              entityId: booking.driverId,
              name: driverExist?.fullName || null,
              type: "CREDIT",
              amount: driverShare,
            },
            {
              entityType: "ADMIN",
              entityId: adminId,
              name: superAdmin?.fullName || "SuperAdmin",
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
              name: driverExist?.fullName,
              id: driverExist?.driverId,
            },
            ride: {
              bookingId: booking.bookingId,
              vehicleType: booking.vehicleType,
              pickup: booking.pickupLocation?.address,
              drop: booking.dropLocation?.address,
            },
          },
        },
      ],
      { session }
    );

    // --- Step 4: Update ride status ---
    booking.rideStatus = RideBookStatusEnum.COMPLETED;
    booking.timestamps.completedAt = Date.now();
    booking.paymentStatus = PaymentStatusEnum.SUCCESS;
    await booking.save({ session });

    // --- Step 5: Make driver online ---
    await DriverLocation.findOneAndUpdate(
      { driverId: booking.driverId },
      { status: LocationStatusEnum.ONLINE }
    );

    await session.commitTransaction();
    session.endSession();

    // --- Step 6: Response payload ---
    const response = {
      rideId: booking.bookingId,
      pickupLocation: {
        address: booking.pickupLocation.address || "",
        coordinates: booking.pickupLocation.coordinates || [],
      },
      dropLocation: {
        address: booking.dropLocation.address || "",
        coordinates: booking.dropLocation.coordinates || [],
      },
      estimatedDistance: booking.distanceInKm || "0 km",
      estimatedFare: booking.fare || 0,
      rideStatus: RideBookStatusEnum.COMPLETED,
      completedAt: booking.timestamps.completedAt.toISOString(),
      verifiedTime: new Date().toISOString(),
    };

    // --- Step 7: Emit socket events ---
    const io = req.io || getIO();
    if (io) {
      io.to(booking.userId.toString()).emit("ride:completed", { ...response });
      io.to(booking.driverId.toString()).emit("ride:completed", {
        ...response,
      });
    }

    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(
          statusCode.OK,
          true,
          translateLn(ln, "RIDE_ALREADY_COMPLETED")
        )
      );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

const rideCancelledByUser = catchAsyncError(async (req, res, next) => {
  const ln = req.get("ln") || "en";
  const rideId = req.params.rideId;
  const { reason } = req.body || {};

  if (!reason) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "CANCELLATION_REASON_REQUIRED")
    );
  }

  const booking = await RideBookingDetail.findOne({ bookingId: rideId });
  if (!booking) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "BOOKING_NOT_FOUND")
    );
  }

  if (
    [RideBookStatusEnum.COMPLETED, RideBookStatusEnum.CANCELLED].includes(
      booking.rideStatus
    )
  ) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "RIDE_CANNOT_BE_CANCELLED_AT_THIS_STAGE")
    );
  }

  booking.rideStatus = RideBookStatusEnum.CANCELLED;
  booking.timestamps.cancelledAt = new Date();
  booking.cancelledBy = BookCancelledByEnum.USER;
  booking.reasonToCancel = reason;
  await booking.save();

  // Free driver if assigned
  if (booking.driverId) {
    await DriverLocation.findOneAndUpdate(
      { driverId: booking.driverId },
      { status: LocationStatusEnum.ONLINE }
    );
  }

  const response = {
    rideId: booking.bookingId,
    by: booking.cancelledBy,
    reason: booking.reasonToCancel,
    cancelled: true,
  };

  const io = req.io || getIO();
  if (io) {
    io.to(booking.userId.toString()).emit("ride:cancelled", response);
    if (booking.driverId) {
      io.to(booking.driverId.toString()).emit("ride:cancelled", response);
    }
  }

  return res.status(statusCode.OK).json(true);
});

const getNearbyDriversExcluding = async (
  pickupLocation,
  excludedDriverIds,
  vehicleType
) => {
  return await DriverLocation.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: pickupLocation.location.coordinates,
        },
        distanceField: "distance",
        spherical: true,
        maxDistance: 3000, // 3 km
      },
    },
    {
      $match: {
        driverId: { $nin: excludedDriverIds },
        vehicleType,
        status: "ONLINE",
      },
    },
  ]);
};

const rideCancelledByDriver = catchAsyncError(async (req, res, next) => {
  const ln = req.get("ln") || "fr";
  const rideId = req.params.rideId;
  const { reason } = req.body || {};

  // 🔹 Validation
  if (!reason) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "CANCELLATION_REASON_REQUIRED")
    );
  }

  // 🔹 Find booking
  const booking = await RideBookingDetail.findOne({ bookingId: rideId });
  if (!booking) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "BOOKING_NOT_FOUND")
    );
  }

  // 🔹 Prevent cancelling if already completed/cancelled
  if (
    [RideBookStatusEnum.COMPLETED, RideBookStatusEnum.CANCELLED].includes(
      booking.rideStatus
    )
  ) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "RIDE_CANNOT_BE_CANCELLED_AT_THIS_STAGE")
    );
  }

  const cancelledDriverId = booking.driverId;

  // ✅ Record cancellation with unique driver (avoid duplicates in array)
  if (
    !booking.cancelledByDrivers.some((d) => d.driverId === cancelledDriverId)
  ) {
    booking.cancelledByDrivers.push({
      driverId: cancelledDriverId,
      cancelledAt: new Date(),
    });
  }

  // 🔹 Update cancellation details
  booking.reasonToCancel = reason;
  booking.cancelledBy = BookCancelledByEnum.DRIVER;

  // ✅ Reset ride for reassignment
  booking.driverId = null;
  booking.rideStatus = RideBookStatusEnum.REQUESTED;
  await booking.save();

  // ✅ Free driver location
  await DriverLocation.findOneAndUpdate(
    { driverId: cancelledDriverId },
    { status: LocationStatusEnum.ONLINE }
  );

  const io = req.io || getIO();

  // 🔔 Notify driver
  io.to(cancelledDriverId.toString()).emit("ride:cancelled", {
    rideId: booking.bookingId,
    by: booking.cancelledBy,
    reason: booking.reasonToCancel,
    cancelled: true,
  });

  // 🔎 Find other drivers excluding cancelled ones
  const excludeDriverIds = booking.cancelledByDrivers.map((d) => d.driverId);
  const availableDrivers = await getNearbyDriversExcluding(
    booking.pickupLocation,
    excludeDriverIds, // 👈 ensures same driver not reassigned
    booking.vehicleType
  );

  if (availableDrivers.length) {
    const vehicle = await VehicleDetail.findOne({
      driverId: availableDrivers[0]?.driverId,
    });

    assignRideToDrivers(
      io,
      booking.bookingId,
      availableDrivers,
      booking,
      vehicle,
      generateOtp()
    );

    return res.status(statusCode.OK).json({
      success: true,
      reassigned: true,
      excludedDrivers: excludeDriverIds,
    });
  }

  // ❌ No drivers left → mark final cancelled
  booking.rideStatus = RideBookStatusEnum.CANCELLED;
  booking.reasonToCancel = "No more drivers available";
  booking.cancelledBy = BookCancelledByEnum.DRIVER;
  booking.timestamps.cancelledAt = new Date();
  await booking.save();

  // 🔔 Notify user
  io.to(booking.userId.toString()).emit("ride:cancelled", {
    rideId: booking.bookingId,
    by: booking.cancelledBy,
    reason: "Driver cancelled the ride",
    cancelled: true,
  });

  return res.status(statusCode.OK).json({
    success: true,
    reassigned: false,
    message: "No drivers available, ride cancelled",
  });
});

const getUserActiveRide = catchAsyncError(async (req, res, next) => {
  const ln = req.get("ln") || "en";
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const userId = decoded?._id;

  if (!userId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  // Fetch active ride
  const activeRide = await RideBookingDetail.findOne({
    userId,
    rideStatus: {
      $nin: [RideBookStatusEnum.COMPLETED, RideBookStatusEnum.CANCELLED],
    },
  })
    .sort({ createdAt: -1 })
    .select(
      "bookingId rideStatus expectedOtp pickupLocation dropLocation otpVerified userId driverId"
    );

  if (!activeRide) {
    return res.status(statusCode.OK).json({
      success: true,
      message: "No active rides found",
      data: null,
    });
  }

  const driverData = await DriverBasicDetails.findOne({
    driverId: activeRide.driverId,
  }).select("driverId fullName phoneNo");

  const rideData = {
    rideId: activeRide.bookingId,
    status: activeRide.rideStatus,
    otp: activeRide.expectedOtp,
    pickupLocation: {
      address: activeRide.pickupLocation?.address || "",
      coordinates: [
        ...(activeRide.pickupLocation?.location?.coordinates ?? []),
      ].reverse(),
    },
    dropLocation: {
      address: activeRide.dropLocation?.address || "",
      coordinates: [
        ...(activeRide.dropLocation?.location?.coordinates || []),
      ].reverse(),
    },
    otpVerified: activeRide.otpVerified,
    user: driverData
      ? {
          _id: driverData.driverId,
          fullName: driverData.fullName,
          phoneNo: driverData.phoneNo,
        }
      : null, // handle missing driver case
  };

  return res.status(statusCode.OK).json({
    success: true,
    data: rideData,
    message: "Active ride fetched successfully",
  });
});

const getDriverActiveRide = catchAsyncError(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const ln = req.get("ln") || "en";

  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded?.driverId;

  if (!driverId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  // Fetch active ride (not completed or cancelled)
  const activeRide = await RideBookingDetail.findOne({
    driverId,
    rideStatus: {
      $nin: [RideBookStatusEnum.COMPLETED, RideBookStatusEnum.CANCELLED],
    },
  })
    .sort({ createdAt: -1 })
    .lean(); // <-- use lean so we can mutate safely

  if (!activeRide) {
    return res.status(statusCode.OK).json({
      success: true,
      message: translateLn(ln, "NO_ACTIVE_RIDES_FOUND"),
      data: null,
    });
  }

  // transform pickupLocation & dropLocation
  const transformLocation = (loc) => {
    if (!loc) return null;
    return {
      address: loc.address,
      coordinates: loc.location?.coordinates
        ? [loc.location.coordinates[1], loc.location.coordinates[0]] // reverse lat/lng
        : [],
    };
  };

  const responseRide = {
    ...activeRide,
    pickupLocation: transformLocation(activeRide.pickupLocation),
    dropLocation: transformLocation(activeRide.dropLocation),
  };

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        responseRide,
        "Active ride fetched successfully"
      )
    );
});

const getDriverAnalytics = catchAsyncError(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded?.driverId;

  if (!driverId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  // Query params
  const entity = (req.query.entity || "completed").toLowerCase(); // completed / cancelled
  const filter = (req.query.filter || "daily").toLowerCase(); // daily / weekly / monthly

  // Date filter logic
  let startDate = new Date();
  let endDate = new Date();

  if (filter === "daily") {
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  } else if (filter === "weekly") {
    const day = startDate.getDay();
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
    startDate = new Date(startDate.setDate(diff));
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  } else if (filter === "monthly") {
    startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    endDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
  }

  // Base match query
  let matchQuery = {
    createdAt: { $gte: startDate, $lte: endDate },
    "entries.entityType": "DRIVER",
    "entries.entityId": driverId,
  };

  if (entity === "completed") {
    matchQuery.status = PaymentStatusEnum.SUCCESS;
    matchQuery["entries.type"] = TransactionTypeEnum.CREDIT;
  } else if (entity === "cancelled") {
    matchQuery.refund = true;
  }

  // Fetch transactions
  const transactions = await TransactionModel.find(matchQuery)
    .sort({ createdAt: -1 })
    .lean();

  if (!transactions.length) {
    return res.status(statusCode.OK).json({
      success: true,
      message: `No ${entity} rides found for this ${filter} period`,
      data: {
        driverId,
        [entity === "completed" ? "totalEarnings" : "totalLoss"]: 0,
        rides: [],
      },
    });
  }

  /**
   * Extract driver-specific ledger entry
   */
  const getDriverEntry = (tx) =>
    tx.entries.find(
      (entry) =>
        entry.entityType === "DRIVER" &&
        entry.entityId === driverId &&
        (entity === "completed"
          ? entry.type === "CREDIT"
          : entry.type === "DEBIT" || tx.refund)
    );

  // Calculate total earnings/loss
  const totalAmount =
    Math.floor(
      transactions.reduce((sum, tx) => {
        const entry = getDriverEntry(tx);
        return sum + (entry?.amount || 0);
      }, 0) * 100
    ) / 100;

  // Fetch ride details
  const bookingIds = transactions.map((tx) => tx.bookingId).filter(Boolean);

  const rides = await RideBookingDetail.find({
    bookingId: { $in: bookingIds },
  }).lean();

  const formattedRides = rides.map((r) => {
    const tx = transactions.find((t) => t.bookingId === r.bookingId);
    const driverEntry = getDriverEntry(tx);

    return {
      bookingId: r.bookingId,
      pickupLocation: {
        address: r.pickupLocation.address,
        coordinates: [
          r.pickupLocation.location.coordinates[1],
          r.pickupLocation.location.coordinates[0],
        ],
      },
      dropLocation: {
        address: r.dropLocation.address,
        coordinates: [
          r.dropLocation.location.coordinates[1],
          r.dropLocation.location.coordinates[0],
        ],
      },
      distanceInKm: r.distanceInKm,
      durationInMin: r.durationInMin,
      fare: r.fare,
      driverShare: driverEntry?.amount || 0,
      rideStatus: r.rideStatus,
      completedAt: r.timestamps?.completedAt,
      cancelledAt: r.timestamps?.cancelledAt,
    };
  });

  const response = {
    driverId,
    [entity === "completed" ? "totalEarnings" : "totalLoss"]: totalAmount,
    rides: formattedRides,
  };

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        response,
        `${entity} rides analytics fetched successfully`
      )
    );
});

const getTripHistory = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  const ln = req.get("ln") || "en";

  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      translateLn("en", "ACCESS_TOKEN_INVALID")
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);

  const entity = req.query.entity;
  if (!entity || !["driver", "user"].includes(entity)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ENTITY_PARAM_REQUIRED")
    );
  }

  const vehicleType = req.query.vehicle;

  if (
    vehicleType &&
    vehicleType !== VehicleTypeEnum.TAXI &&
    vehicleType !== VehicleTypeEnum.BIKE
  ) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "INVALID_VEHICLE_TYPE")
    );
  }

  let entityId;

  if (entity === "driver") {
    entityId = decoded?.driverId;

    if (!entityId) {
      throw new ApiError(
        statusCode.UNAUTHORIZED,
        translateLn(ln, "INVALID_DRIVER_TOKEN")
      );
    }
  } else {
    entityId = decoded?._id;

    if (!entityId) {
      throw new ApiError(
        statusCode.UNAUTHORIZED,
        translateLn(ln, "INVALID_USER_TOKEN")
      );
    }
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  let allTrips,
    totalTrips,
    nameMap = {};

  let baseConditions = {};

  if (entity === "driver") {
    baseConditions = {
      $or: [
        { driverId: entityId, rideStatus: RideBookStatusEnum.COMPLETED },
        { "cancelledByDrivers.driverId": entityId },
      ],
    };
  } else {
    baseConditions = {
      userId: entityId,
      $or: [
        { rideStatus: RideBookStatusEnum.COMPLETED },
        { rideStatus: RideBookStatusEnum.CANCELLED },
      ],
    };
  }

  if (vehicleType) {
    baseConditions.vehicleType = vehicleType;
  }

  if (entity === "driver") {
    const driverExists = await DriverBasicDetails.exists({
      driverId: entityId,
    });

    if (!driverExists) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        translateLn(ln, "DRIVER_NOT_FOUND")
      );
    }

    [allTrips, totalTrips] = await Promise.all([
      RideBookingDetail.find(baseConditions)
        .sort({ "timestamps.completedAt": -1, "timestamps.cancelledAt": -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      RideBookingDetail.countDocuments(baseConditions),
    ]);

    const userIds = allTrips.map((trip) => trip.userId).filter((id) => id);

    const users = await UserModel.find(
      { _id: { $in: userIds } },
      { _id: 1, fullName: 1 }
    ).lean();

    users.forEach((user) => {
      nameMap[user._id.toString()] = user.fullName;
    });
  } else {
    const userExists = await UserModel.exists({ _id: entityId });

    if (!userExists) {
      throw new ApiError(
        statusCode.NOT_FOUND,
        translateLn(ln, "USER_NOT_FOUND")
      );
    }

    [allTrips, totalTrips] = await Promise.all([
      RideBookingDetail.find(baseConditions)
        .sort({ "timestamps.completedAt": -1, "timestamps.cancelledAt": -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      RideBookingDetail.countDocuments(baseConditions),
    ]);

    const driverIds = allTrips.map((trip) => trip.driverId).filter((id) => id);

    const drivers = await DriverBasicDetails.find(
      { driverId: { $in: driverIds } },
      { driverId: 1, fullName: 1 }
    ).lean();

    drivers.forEach((driver) => {
      nameMap[driver.driverId] = driver.fullName;
    });
  }

  const tripHistory = allTrips.map((trip) => {
    const baseData = {
      rideId: trip.bookingId,
      from: trip.pickupLocation?.address,
      to: trip.dropLocation?.address,
      requestedAt: trip.timestamps?.requestedAt,
      vehicleType: trip.vehicleType,
      price: trip.fare,
      currency: process.env.MOMO_CURRENCY || "EUR",
      tripRating: trip.tripRating || null,
    };

    if (entity === "driver") {
      baseData.userName =
        nameMap[trip.userId?.toString()] || translateLn(ln, "UNKNOWN_USER");

      if (
        trip.rideStatus === RideBookStatusEnum.COMPLETED &&
        trip.driverId === entityId
      ) {
        return {
          ...baseData,
          status: "completed",
          pickupAt: trip.timestamps?.pickupAt,
          completedAt: trip.timestamps?.completedAt,
          timestamp: trip.timestamps?.completedAt,
        };
      }

      const cancelledRecord = trip.cancelledByDrivers?.find(
        (c) => c.driverId === entityId
      );

      if (cancelledRecord) {
        return {
          ...baseData,
          status: "cancelled",
          cancelledAt:
            cancelledRecord.cancelledAt || trip.timestamps?.cancelledAt,
          timestamp:
            cancelledRecord.cancelledAt || trip.timestamps?.cancelledAt,
        };
      }
    } else {
      baseData.driverName =
        nameMap[trip.driverId] || translateLn(ln, "UNKNOWN_DRIVER");

      if (trip.rideStatus === RideBookStatusEnum.COMPLETED) {
        return {
          ...baseData,
          status: "completed",
          pickupAt: trip.timestamps?.pickupAt,
          completedAt: trip.timestamps?.completedAt,
          timestamp: trip.timestamps?.completedAt,
        };
      }

      if (trip.rideStatus === RideBookStatusEnum.CANCELLED) {
        return {
          ...baseData,
          status: "cancelled",
          cancelledAt: trip.timestamps?.cancelledAt,
          timestamp: trip.timestamps?.cancelledAt,
        };
      }
    }

    return {
      ...baseData,
      status: "unknown",
      timestamp: trip.timestamps?.requestedAt,
    };
  });

  tripHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const pagination = {
    page,
    limit,
    total: totalTrips,
    totalPages: Math.ceil(totalTrips / limit),
  };

  const data = {
    [entity === "driver" ? "driverId" : "userId"]: entityId,
    rides: tripHistory,
    pagination,
    ...(vehicleType && { vehicleFilter: vehicleType }),
  };

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        data,
        translateLn(ln, "TRIP_HISTORY_FETCHED")
      )
    );
});

const giveRatings = catchAsyncError(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const userId = decoded?._id;

  if (!userId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const { rideId, rating, feedback } = req.body;

  // Validate required fields
  if (!rideId || !rating) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Ride ID and rating are required"
    );
  }

  // Validate rating range
  if (rating < 1 || rating > 5) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Rating must be between 1 and 5"
    );
  }

  // Find the ride
  const ride = await RideBookingDetail.findOne({
    bookingId: rideId,
    userId: userId,
  });

  if (!ride) {
    throw new ApiError(statusCode.NOT_FOUND, "Ride not found");
  }

  // Check if ride is completed
  if (ride.rideStatus !== RideBookStatusEnum.COMPLETED) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "You can only rate completed rides"
    );
  }

  // Update ride with rating and feedback
  const updateData = {
    tripRating: rating,
    ...(feedback && { feedbackFromUser: feedback }),
  };

  const updatedRide = await RideBookingDetail.findOneAndUpdate(
    { bookingId: rideId, userId: userId },
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!updatedRide) {
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      "Failed to update rating"
    );
  }

  // Update driver's average rating
  if (ride.driverId) {
    // Get all completed rides for this driver with ratings
    const driverRides = await RideBookingDetail.find({
      driverId: ride.driverId,
      rideStatus: RideBookStatusEnum.COMPLETED,
      tripRating: { $exists: true, $gte: 1, $lte: 5 },
    });

    // Calculate new average rating
    const totalRatings = driverRides.length;
    const sumOfRatings = driverRides.reduce(
      (sum, ride) => sum + ride.tripRating,
      0
    );
    const averageRating =
      totalRatings > 0 ? sumOfRatings / totalRatings : rating;

    // Update or create driver rating with upsert
    await DriverBasicDetails.findOneAndUpdate(
      { driverId: ride.driverId },
      {
        $set: {
          ratings: parseFloat(averageRating.toFixed(1)),
          totalRatings: totalRatings,
        },
        $setOnInsert: {
          driverId: ride.driverId,
          rating: parseFloat(averageRating.toFixed(1)),
          totalRatings: totalRatings,
        },
      },
      {
        upsert: true,
        runValidators: true,
      }
    );
  }

  const response = {
    rideId: updatedRide.bookingId,
    rating: updatedRide.tripRating,
    feedback: updatedRide.feedbackFromUser,
    status: updatedRide.rideStatus,
    message: "Rating submitted successfully",
  };

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, response, "Rating submitted successfully")
    );
});

module.exports = {
  estimateRide,
  requestRide,
  cancelRideByUser,
  getUserDetailsByRideId,
  getDriverDetailsByRideId,
  verifyOtp,
  completeRide,
  rideCancelledByUser,
  rideCancelledByDriver,
  getUserActiveRide,
  getDriverActiveRide,
  getDriverAnalytics,
  getTripHistory,
  giveRatings,
};

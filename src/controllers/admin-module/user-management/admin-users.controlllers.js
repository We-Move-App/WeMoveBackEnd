const {
  UserBankModel,
} = require("../../../models/user-module/user-banks/user-banks.model");
const {
  UserDocumentModel,
} = require("../../../models/user-module/user-documents/user-document.model");
const UserModel = require("../../../models/user-module/users/user.model");
const statusCode = require("../../../utils/constants/statusCode");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  getUserByIdByAdmin,
  getAllUsersByAdmin,
  userVerifiedByAdmin,
} = require("../../../utils/services/admin.services");
const HotelBookingModel = require("../../../models/hotel-module/hotel-bookings/hotel-bookings.model");
const BusBookingModel = require("../../../models/bus-module/bus-bookings/bus-bookings.model");
const RideBookingDetail = require("../../../models/new-driver-module/booking-details/booking-details.model");
const BusModel = require("../../../models/bus-module/buses/buses.model");
const {
  UserAddressModel,
} = require("../../../models/user-module/user-address/user-address.model");
const SecurePinModel = require("../../../models/global-module/secure-pins/secure-pins.model");
const mongoose = require("mongoose");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const transactionModel = require("../../../models/transaction-module/transaction.model");
const walletsModel = require("../../../models/wallet-module/wallets.model");
const { fetchAdminLn } = require("../../../utils/services/user.services");
const { translateLn } = require("../../../utils/services/translator.service");
const UserHistoryModel = require("../../../models/user-module/users/userHistory.model");
const {
  validateEmail,
  validatePhoneNumber,
} = require("../../../utils/validation/forSchema");
const BusOperatorModel = require("../../../models/bus-module/bus-operator/bus-operator.model");
const HotelManagerModel = require("../../../models/hotel-module/hotel-manager/hotel-manager.model");

const getAllUsers = catchAsyncError(async (req, res) => {
  const {
    search,
    verificationStatus,
    page,
    limit,
    sortBy = "createdAt",
    order = "desc",
  } = req.query;

  const ln = (req.headers["ln"] || "en").toLowerCase();

  // Pagination
  const pageNum = page ? Math.max(parseInt(page, 10), 1) : 1;
  const limitNum = limit ? Math.max(parseInt(limit, 10), 1) : 20;
  const skip = (pageNum - 1) * limitNum;

  const filter = {};

  if (search) {
    const regex = new RegExp(search, "i");

    filter.$or = [
      { fullName: regex },
      { email: regex },
      { phoneNumber: regex },
      { userId: regex },
    ];
  }

  if (verificationStatus) {
    filter.verificationStatus = new RegExp(verificationStatus, "i");
  }

  // Total users
  const total = await UserModel.countDocuments(filter);

  if (total === 0) {
    return res.status(404).json({
      success: false,
      message: translateLn(ln, "NO_USERS_FOUND"),
      total: 0,
      page: pageNum,
      limit: limitNum,
      sortBy,
      order,
      data: [],
    });
  }

  const sort = { createdAt: -1 };

  let data = await UserModel.find(
    filter,
    "fullName phoneNumber email verificationStatus createdAt userId user_id"
  )
    .skip(skip)
    .limit(limitNum)
    .sort(sort)
    .lean();

  // Translate verificationStatus
  data = data.map((user) => ({
    ...user,
    verificationStatus: user.verificationStatus,
  }));

  res.status(200).json({
    success: true,
    message: translateLn(ln, "USERS_FETCHED_SUCCESSFULLY"),
    totalUsers: total,
    page: pageNum,
    limit: limitNum,
    sortBy: "createdAt",
    order: "desc",
    data,
  });
});

const getSingleUser = catchAsyncError(async (req, res, next) => {
  const { _id } = req.params;

  const ln = (req.headers["ln"] || "en").toLowerCase();

  if (!_id || typeof _id !== "string" || _id.trim() === "") {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "User _id is required and must be a valid string"
    );
  }

  const user = await UserModel.findById(_id)

    .select("-password -__v") // keep userId
    .populate("branch", "name code location")
    .populate("verifiedBy.admin", "fullName email")
    .lean();

  if (!user) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "No user found with the given User ID"
    );
  }

  // ✅ 3. Use user._id (Mongo ObjectId) for relations
  const userObjectId = user._id;

  // ✅ 4. Fetch related models using Mongo _id
  const [documents, bankDetails, pinDetails, userAddress] = await Promise.all([
    UserDocumentModel.findOne({ userId: userObjectId })
      .populate("documentIds")
      .lean(),
    UserBankModel.findOne({ userId: userObjectId }).lean(),
    SecurePinModel.findOne({ userId: userObjectId }).select("_id").lean(),
    UserAddressModel.findOne({ userId: userObjectId })
      .populate("address")
      .lean(),
  ]);

  // ✅ 5. Combine and format data
  const profileData = {
    ...user,
    verificationStatus: user.verificationStatus,
    address: userAddress?.address || null,
    document: documents || null,
    bankDetails: bankDetails || null,
    isPinExist: !!pinDetails,
  };

  // ✅ 6. Send clean response
  return res.status(statusCode.OK).json({
    success: true,
    statusCode: 200,
    message: translateLn(ln, "USER_PROFILE_FETCHED"),
    data: profileData,
  });
});

const verifyUserProfile = catchAsyncError(async (req, res, next) => {
  const result = await userVerifiedByAdmin({ req, model: UserModel });

  return res.status(statusCode.OK).json(result);
});

const deleteUserPermanently = catchAsyncError(async (req, res, next) => {
  const { userId } = req.params;

  const [user, userBank, userDocs] = await Promise.all([
    UserModel.findById(_id),
    UserBankModel.findOne({ userId: _id }),
    UserDocumentModel.findOne({ userId: _id }).populate("documentIds"),
  ]);
});

const getAllUsersBookings = catchAsyncError(async (req, res) => {
  const adminId = req.user._id;
  const ln = (req.headers["ln"] || "en").toLowerCase();

  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    order = "desc",
    search = "",
    paymentStatus = "",
  } = req.query;

  const pageNum = Math.max(parseInt(page, 10), 1);
  const limitNum = Math.max(parseInt(limit, 10), 1);
  const skip = (pageNum - 1) * limitNum;
  const sortOrder = order.toLowerCase() === "asc" ? 1 : -1;

  // ---------------- FILTER ----------------
  const buildFilter = (extra = {}) => {
    const filter = { ...extra };

    if (paymentStatus && paymentStatus.trim() !== "") {
      filter.paymentStatus = new RegExp(`^${paymentStatus.trim()}$`, "i");
    }

    if (search && search.trim() !== "") {
      const regex = new RegExp(search.trim(), "i");

      filter.$or = [
        { bookingId: regex },
        { email: regex },
        { phoneNumber: regex },
        { userId: regex },
      ];
    }

    return filter;
  };

  // ---------------- FETCH BOOKINGS ----------------
  const [busBookings, hotelBookings, rideBookings] = await Promise.all([
    BusBookingModel.find(
      buildFilter(),
      `
      bookingId
      bookedBy
      bookedByOperator
      bookingBy
      passengers
      email
      phoneNumber
      journeyDate
      price
      paymentStatus
      createdAt
    `
    ).lean(),

    HotelBookingModel.find(
      buildFilter(),
      `
      bookingId
      bookedBy
      bookingBy
      user
      checkInDate
      totalAmount
      paymentStatus
      createdAt
    `
    ).lean(),

    RideBookingDetail.find(
      buildFilter(),
      `
      bookingId
      userId
      timestamps.completedAt
      fare
      paymentStatus
      createdAt
    `
    ).lean(),
  ]);

  // ---------------- USER IDS ----------------
  const busHotelUserIds = [
    ...new Set(
      [
        ...busBookings
          .filter((b) => b.bookingBy !== "busOperator")
          .map((b) => b.bookedBy)
          .filter(Boolean),

        ...hotelBookings
          .filter((h) => h.bookingBy !== "Hotel-Manager")
          .map((h) => h.bookedBy)
          .filter(Boolean),
      ].map((id) => String(id))
    ),
  ];

  const busHotelObjectIds = busHotelUserIds
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const busHotelUsers = busHotelObjectIds.length
    ? await UserModel.find({
        _id: { $in: busHotelObjectIds },
      })
        .select("_id userId fullName email phoneNumber")
        .lean()
    : [];

  const userByObjectId = new Map(busHotelUsers.map((u) => [String(u._id), u]));

  // ---------------- BUS OPERATORS ----------------
  const busOperatorIds = [
    ...new Set(
      busBookings
        .filter((b) => b.bookingBy === "busOperator" && b.bookedByOperator)
        .map((b) => String(b.bookedByOperator))
    ),
  ];

  const busOperators = busOperatorIds.length
    ? await BusOperatorModel.find({
        _id: { $in: busOperatorIds },
      })
        .select("_id operatorId")
        .lean()
    : [];

  const busOperatorMap = new Map(busOperators.map((o) => [String(o._id), o]));

  // ---------------- HOTEL MANAGERS ----------------
  const hotelManagerIds = [
    ...new Set(
      hotelBookings
        .filter((h) => h.bookingBy === "Hotel-Manager" && h.bookedBy)
        .map((h) => String(h.bookedBy))
    ),
  ];

  const hotelManagers = hotelManagerIds.length
    ? await HotelManagerModel.find({
        _id: { $in: hotelManagerIds },
      })
        .select("_id managerId")
        .lean()
    : [];

  const hotelManagerMap = new Map(hotelManagers.map((m) => [String(m._id), m]));

  // ---------------- RIDE USERS ----------------
  const rawRideIds = rideBookings
    .map((r) => (typeof r.userId === "string" ? r.userId.trim() : r.userId))
    .filter(Boolean);

  const uniqueRideIds = [...new Set(rawRideIds)];

  const rideObjectIdStrings = uniqueRideIds.filter((id) =>
    mongoose.isValidObjectId(id)
  );

  const rideAppUserIds = uniqueRideIds.filter(
    (id) => !mongoose.isValidObjectId(id)
  );

  const rideObjectIds = rideObjectIdStrings.map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  const [usersByRideObjectId, usersByRideAppUserId] = await Promise.all([
    rideObjectIds.length
      ? UserModel.find({
          _id: { $in: rideObjectIds },
        })
          .select("_id userId fullName email phoneNumber")
          .lean()
      : Promise.resolve([]),

    rideAppUserIds.length
      ? UserModel.find({
          userId: { $in: rideAppUserIds },
        })
          .select("_id userId fullName email phoneNumber")
          .lean()
      : Promise.resolve([]),
  ]);

  const rideMapByObjectId = new Map(
    usersByRideObjectId.map((u) => [String(u._id), u])
  );

  const rideMapByUserId = new Map(
    usersByRideAppUserId.map((u) => [u.userId, u])
  );

  // ---------------- FORMAT BUS BOOKINGS ----------------
  const formattedBusBookings = busBookings.map((b) => {
    let userId = null;
    let fullName = null;
    let email = null;
    let phone = null;
    let _id = null;

    // Offline booking by operator
    if (b.bookingBy === "busOperator") {
      const passenger = b.passengers?.[0];

      const operator = b.bookedByOperator
        ? busOperatorMap.get(String(b.bookedByOperator))
        : null;

      _id = operator?._id || null;
      userId = operator?.operatorId || null;

      fullName = passenger?.name || null;
      email = passenger?.email || b.email || null;
      phone = passenger?.contactNumber || b.phoneNumber || null;
    } else {
      // App user booking
      const u = b.bookedBy ? userByObjectId.get(String(b.bookedBy)) : null;

      _id = u?._id || null;
      userId = u?.userId || null;
      fullName = u?.fullName || null;
      email = u?.email || null;
      phone = u?.phoneNumber || null;
    }

    return {
      _id,
      bookingId: b.bookingId || null,
      userId,
      fullName,
      email,
      phone,
      serviceType: translateLn(ln, "MODULE_BUS"),
      bookingDate: b.journeyDate || null,
      amount: b.price ?? 0,
      paymentStatus: b.paymentStatus || "PENDING",
      createdAt: b.createdAt,
    };
  });

  // ---------------- FORMAT HOTEL BOOKINGS ----------------
  const formattedHotelBookings = hotelBookings.map((h) => {
    let userId = null;
    let fullName = null;
    let email = null;
    let phone = null;
    let _id = null;

    // Offline booking by hotel manager
    if (h.bookingBy === "Hotel-Manager") {
      const passenger = h.user?.[0];

      const manager = h.bookedBy
        ? hotelManagerMap.get(String(h.bookedBy))
        : null;

      _id = manager?._id || null;
      userId = manager?.managerId || null;

      fullName = passenger?.name || null;
      email = passenger?.email || null;
      phone = passenger?.phoneNumber || null;
    } else {
      // App user booking
      const u = h.bookedBy ? userByObjectId.get(String(h.bookedBy)) : null;

      _id = u?._id || null;
      userId = u?.userId || null;
      fullName = u?.fullName || null;
      email = u?.email || null;
      phone = u?.phoneNumber || null;
    }

    return {
      _id,
      bookingId: h.bookingId || null,
      userId,
      fullName,
      email,
      phone,
      serviceType: translateLn(ln, "MODULE_HOTEL"),
      bookingDate: h.checkInDate || null,
      amount: h.totalAmount ?? 0,
      paymentStatus: h.paymentStatus || "PENDING",
      createdAt: h.createdAt,
    };
  });

  // ---------------- FORMAT RIDE BOOKINGS ----------------
  // ---------------- FORMAT RIDE BOOKINGS ----------------
  const formattedRideBookings = rideBookings.map((r) => {
    const key = typeof r.userId === "string" ? r.userId.trim() : r.userId;

    const u = rideMapByUserId.get(key) || rideMapByObjectId.get(key);

    return {
      _id: u?._id || null,
      bookingId: r.bookingId || null,
      userId: u?.userId || key || null,
      fullName: u?.fullName || null,
      email: u?.email || null,
      phone: u?.phoneNumber || null,
      serviceType: translateLn(ln, "MODULE_RIDE"),

      // FIXED
      bookingDate: r.createdAt || null,

      amount: r.fare ?? 0,
      paymentStatus: r.paymentStatus || "PENDING",
      createdAt: r.createdAt,
    };
  });

  // ---------------- MERGE ----------------
  const allBookings = [
    ...formattedBusBookings,
    ...formattedHotelBookings,
    ...formattedRideBookings,
  ];

  // ---------------- SORT ----------------
  const sortedBookings = allBookings.sort((a, b) => {
    const aVal = a[sortBy] || 0;
    const bVal = b[sortBy] || 0;

    if (aVal > bVal) return sortOrder;
    if (aVal < bVal) return -sortOrder;

    return 0;
  });

  // ---------------- PAGINATION ----------------
  const total = sortedBookings.length;

  const paginatedBookings = sortedBookings.slice(skip, skip + limitNum);

  return res.status(200).json({
    success: true,
    message: translateLn(
      ln,
      total === 0 ? "NO_BOOKINGS_FOUND" : "ALL_BOOKINGS_RETRIEVED_SUCCESS"
    ),

    total,
    page: pageNum,
    limit: limitNum,
    sortBy,
    order,
    search,
    filter: paymentStatus || null,

    data: paginatedBookings,
  });
});

const getAllBookingsByUserId = catchAsyncError(async (req, res) => {
  const { userId } = req.params;
  const { filter, search } = req.query;
  const ln = (req.headers["ln"] || "en").toLowerCase();

  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const perPage = Math.min(
    Math.max(parseInt(req.query.limit || "20", 10), 1),
    100
  );
  const skip = (page - 1) * perPage;

  if (!filter || !userId) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "filter and userId are required"
    );
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid userId");
  }

  const user = await UserModel.findById(userId).lean();
  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  const getTransactionKey = (type = "") => {
    const t = type.toLowerCase();

    if (t.includes("ride")) return "TRANSACTION_RIDE";
    if (t.includes("bus")) return "TRANSACTION_BUS";
    if (t.includes("hotel")) return "TRANSACTION_HOTEL";
    if (t.includes("wallet")) return "TRANSACTION_WALLET";
    if (t.includes("user to user")) {
      return "TRANSACTION_USER_TO_USER";
    }

    return null;
  };

  const buildSearchQuery = (base = {}) => {
    if (search && search.trim() !== "") {
      const regex = new RegExp(search, "i");
      base.$or = [{ bookingId: regex }, { transactionId: regex }];
    }
    return base;
  };

  const paginate = async (Model, query, message) => {
    const [items, total] = await Promise.all([
      Model.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perPage)
        .lean(),
      Model.countDocuments(query),
    ]);

    const totalPages = Math.max(Math.ceil(total / perPage), 1);

    return res.status(statusCode.OK).json(
      new ApiResponse(
        statusCode.OK,
        {
          pagination: { page, limit: perPage, total, totalPages },
          count: items.length,
          bookings: items.map((item) => ({
            ...item,
            transactionType:
              translateLn(ln, getTransactionKey(item.transactionType)) ||
              item.transactionType,

            entries: (item.entries || []).map((entry) => ({
              ...entry,
              type: translateLn(ln, `TYPE_${entry.type}`) || entry.type,
            })),
          })),
        },
        message
      )
    );
  };

  switch (filter) {
    case "bus":
      return paginate(
        BusBookingModel,
        buildSearchQuery({ bookedBy: userId }),
        "Bus bookings fetched successfully"
      );

    case "hotel":
      return paginate(
        HotelBookingModel,
        buildSearchQuery({ bookedBy: userId }),
        "Hotel bookings fetched successfully"
      );

    case "ride":
      return paginate(
        RideBookingDetail,
        buildSearchQuery({ userId }),
        "Ride bookings fetched successfully"
      );

    case "transactions":
      return paginate(
        transactionModel,
        buildSearchQuery({
          entries: {
            $elemMatch: {
              entityType: "USER",
              entityId: userId,
            },
          },
        }),
        "Transactions fetched successfully"
      );

    case "count": {
      const busQuery = buildSearchQuery({ bookedBy: userId });
      const hotelQuery = buildSearchQuery({ bookedBy: userId });
      const rideQuery = buildSearchQuery({ userId });

      const [busTotal, hotelTotal, rideTotal] = await Promise.all([
        BusBookingModel.countDocuments(busQuery),
        HotelBookingModel.countDocuments(hotelQuery),
        RideBookingDetail.countDocuments(rideQuery),
      ]);

      const total = busTotal + hotelTotal + rideTotal;

      return res.status(statusCode.OK).json(
        new ApiResponse(
          statusCode.OK,
          {
            countsByType: { bus: busTotal, hotel: hotelTotal, ride: rideTotal },
            total,
          },
          "Booking counts fetched successfully"
        )
      );
    }

    case "all": {
      const busQuery = buildSearchQuery({ bookedBy: userId });
      const hotelQuery = buildSearchQuery({ bookedBy: userId });
      const rideQuery = buildSearchQuery({ userId });

      const [busTotal, hotelTotal, rideTotal] = await Promise.all([
        BusBookingModel.countDocuments(busQuery),
        HotelBookingModel.countDocuments(hotelQuery),
        RideBookingDetail.countDocuments(rideQuery),
      ]);

      const total = busTotal + hotelTotal + rideTotal;
      const totalPages = Math.max(Math.ceil(total / perPage), 1);

      if (total === 0) {
        return res.status(statusCode.OK).json(
          new ApiResponse(
            statusCode.OK,
            {
              pagination: { page, limit: perPage, total: 0, totalPages: 1 },
              count: 0,
              countsByType: { bus: 0, hotel: 0, ride: 0 },
              bookings: [],
            },
            "No bookings found"
          )
        );
      }

      const [busItems, hotelItems, rideItems] = await Promise.all([
        BusBookingModel.find(busQuery).sort({ createdAt: -1 }).lean(),
        HotelBookingModel.find(hotelQuery).sort({ createdAt: -1 }).lean(),
        RideBookingDetail.find(rideQuery).sort({ createdAt: -1 }).lean(),
      ]);

      const merged = [
        ...busItems.map((d) => ({
          ...d,
          source: translateLn(ln, "SOURCE_BUS"),
        })),
        ...hotelItems.map((d) => ({
          ...d,
          source: translateLn(ln, "SOURCE_HOTEL"),
        })),
        ...rideItems.map((d) => ({
          ...d,
          source: translateLn(ln, "SOURCE_RIDE"),
        })),
      ].sort((a, b) => {
        const ac = new Date(a.createdAt || 0).getTime();
        const bc = new Date(b.createdAt || 0).getTime();
        if (bc !== ac) return bc - ac;
        return String(b._id).localeCompare(String(a._id));
      });

      const pageSlice = merged.slice(skip, skip + perPage);

      return res.status(statusCode.OK).json(
        new ApiResponse(
          statusCode.OK,
          {
            pagination: { page, limit: perPage, total, totalPages },
            count: pageSlice.length,
            countsByType: { bus: busTotal, hotel: hotelTotal, ride: rideTotal },
            bookings: pageSlice,
          },
          "All bookings (bus, hotel, ride) fetched successfully"
        )
      );
    }

    default:
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "Unknown filter. Use one of: bus, hotel, ride, transactions, all"
      );
  }
});

const getWalletBalance = catchAsyncError(async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    throw new ApiError(statusCode.BAD_REQUEST, "userId is required");
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  const wallet = await walletsModel.findOne({ userId: userId });
  if (!wallet) {
    throw new ApiError(statusCode.NOT_FOUND, "Wallet not found");
  }

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        cardNumber: wallet?.cardNumber || null,
        balance: wallet?.balance || 0,
      },
      "Wallet balance found successfully"
    )
  );
});

const updateUserByAdmin = catchAsyncError(async (req, res, next) => {
  const { userId } = req.params;
  let { email, phoneNumber } = req.body;

  const adminId = req.user?._id;
  const ln = (req.headers["ln"] || "en").toLowerCase();

  if (!email && !phoneNumber) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ERROR_REQUIRED_CONTACT")
    );
  }

  if (email !== undefined) {
    if (typeof email !== "string" || !email.trim()) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        translateLn(ln, "ERROR_INVALID_EMAIL")
      );
    }
    email = email.trim().toLowerCase();
    if (!validateEmail(email)) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        translateLn(ln, "ERROR_INVALID_PHONE")
      );
    }
  }

  if (phoneNumber !== undefined) {
    phoneNumber = Array.isArray(phoneNumber)
      ? phoneNumber.find((num) => typeof num === "string" && num.trim())
      : phoneNumber;

    if (!phoneNumber || typeof phoneNumber !== "string") {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "Phone number must be a valid string"
      );
    }

    phoneNumber = phoneNumber.trim();

    if (!validatePhoneNumber(phoneNumber)) {
      throw new ApiError(statusCode.BAD_REQUEST, "Invalid phone number format");
    }
  }

  const existingUser = await UserModel.findById(userId);

  if (!existingUser) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "ERROR_USER_NOT_FOUND")
    );
  }

  if (email && email === existingUser.email) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ERROR_SAME_EMAIL")
    );
  }

  if (phoneNumber && phoneNumber === existingUser.phoneNumber) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ERROR_SAME_PHONE")
    );
  }

  const duplicateUser = await UserModel.findOne({
    _id: { $ne: userId },
    $or: [
      ...(email ? [{ email }] : []),
      ...(phoneNumber ? [{ phoneNumber }] : []),
    ],
  });

  if (duplicateUser) {
    throw new ApiError(
      statusCode.CONFLICT,
      translateLn(ln, "ERROR_DUPLICATE_EMAIL_PHONE")
    );
  }

  if (email) {
    const emailUsedBefore = await UserHistoryModel.findOne({
      $or: [{ previousEmail: email }, { newEmail: email }],
    });

    if (emailUsedBefore) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        translateLn(ln, "ERROR_EMAIL_USED_BEFORE")
      );
    }
  }

  if (phoneNumber) {
    const phoneUsedBefore = await UserHistoryModel.findOne({
      $or: [
        { previousPhoneNumber: phoneNumber },
        { newPhoneNumber: phoneNumber },
      ],
    });

    if (phoneUsedBefore) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        translateLn(ln, "ERROR_PHONE_USED_BEFORE")
      );
    }
  }

  const updateData = {};
  const historyPayload = {
    userId,
    changedBy: adminId,
  };

  if (email) {
    updateData.email = email;
    updateData.emailVerified = false;
    historyPayload.previousEmail = existingUser.email || null;
    historyPayload.newEmail = email;
  }

  if (phoneNumber) {
    updateData.phoneNumber = phoneNumber;
    updateData.phoneVerified = false;
    historyPayload.previousPhoneNumber = existingUser.phoneNumber || null;
    historyPayload.newPhoneNumber = phoneNumber;
  }

  const updatedUser = await UserModel.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select("-password");

  await UserHistoryModel.create(historyPayload);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { user: updatedUser },
        translateLn(ln, "SUCCESS_UPDATE_CONTACT")
      )
    );
});

module.exports = {
  getAllUsers,
  getSingleUser,
  verifyUserProfile,
  getAllUsersBookings,
  getAllBookingsByUserId,
  getWalletBalance,
  updateUserByAdmin,
};

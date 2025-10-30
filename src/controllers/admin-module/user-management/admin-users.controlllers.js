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

const getAllUsers = catchAsyncError(async (req, res) => {
  const {
    search,
    verificationStatus,
    page,
    limit,
    sortBy = "createdAt",
    order = "desc",
  } = req.query;

  // 🔹 Dynamic page & limit (default if UI doesn’t send)
  const pageNum = page ? Math.max(parseInt(page, 10), 1) : 1;
  const limitNum = limit ? Math.max(parseInt(limit, 10), 1) : 20;
  const skip = (pageNum - 1) * limitNum;

  // 🔍 Build filter
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

  // 🔹 Get total count for pagination

  const total = await UserModel.countDocuments(filter);

  if (total === 0) {
    return res.status(404).json({
      success: false,
      message: "No users found",
      total: 0,
      page: pageNum,
      limit: limitNum,
      sortBy,
      order,
      data: [],
    });
  }

  // 🔹 Sorting
  const sortOrder = order.toLowerCase() === "desc" ? -1 : 1;
  const sort = {};
  sort[sortBy] = sortOrder;

  // 🔹 Fetch with pagination + sorting
  const data = await UserModel.find(
    filter,
    "fullName phoneNumber email verificationStatus createdAt userId user_id"
  )
    .skip(skip)
    .limit(limitNum)
    .sort(sort);

  res.status(200).json({
    success: true,
    message: "Users fetched successfully",
    totaluser: total,
    page: pageNum,
    limit: limitNum,
    sortBy,
    order,
    data,
  });
});

const getSingleUser = catchAsyncError(async (req, res, next) => {
  const { _id } = req.params;
  // ✅ 1. Validate _id param

  if (!_id || typeof _id !== "string" || _id.trim() === "") {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "User _id is required and must be a valid string"
    );
  }

  // ✅ 2. Find the user using custom userId (not _id)
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
    address: userAddress?.address || null,
    document: documents || null,
    bankDetails: bankDetails || null,
    isPinExist: !!pinDetails,
  };

  // ✅ 6. Send clean response
  return res.status(statusCode.OK).json({
    success: true,
    statusCode: 200,
    message: "User profile fetched successfully",
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

  // ✅ Build filter only if search or paymentStatus is provided
  const buildFilter = (extra = {}) => {
    const filter = { ...extra };
    if (paymentStatus && paymentStatus.trim() !== "")
      filter.paymentStatus = new RegExp(`^${paymentStatus.trim()}$`, "i");

    if (search && search.trim() !== "") {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { bookingId: regex },
        { email: regex },
        { phoneNumber: regex },
        { "bookedBy.email": regex },
        { "bookedBy.fullName": regex },
        { "bookedBy.userId": regex },
        { "userId.email": regex },
        { "userId.fullName": regex },
        { "userId.userId": regex },
      ];
    }

    return filter;
  };

  // ✅ Fetch all bookings in parallel (bus, hotel, ride)
  const [busBookings, hotelBookings, rideBookings] = await Promise.all([
    BusBookingModel.find(
      buildFilter(),
      "bookingId bookedBy journeyDate price paymentStatus createdAt"
    )
      .populate("bookedBy", "userId fullName email phoneNumber")
      .lean(),

    HotelBookingModel.find(
      buildFilter(),
      "bookingId bookedBy checkInDate totalAmount paymentStatus createdAt"
    )
      .populate("bookedBy", "userId fullName email phoneNumber")
      .lean(),

    RideBookingDetail.find(
      buildFilter(),
      "bookingId userId timestamps.completedAt fare paymentStatus createdAt"
    )
      .populate("userId", "userId fullName email phoneNumber")
      .lean(),
  ]);

  // ✅ Format data consistently
  const formattedBusBookings = busBookings.map((b) => ({
    bookingId: b.bookingId || null,
    userId: b.bookedBy?.userId || null,
    fullName: b.bookedBy?.fullName || null,
    email: b.bookedBy?.email || null,
    phone: b.bookedBy?.phoneNumber || null,
    serviceType: "bus",
    bookingDate: b.journeyDate || null,
    amount: b.price || 0,
    paymentStatus: b.paymentStatus || "PENDING",
    createdAt: b.createdAt,
  }));

  const formattedHotelBookings = hotelBookings.map((h) => ({
    bookingId: h.bookingId || null,
    userId: h.bookedBy?.userId || null,
    fullName: h.bookedBy?.fullName || null,
    email: h.bookedBy?.email || null,
    phone: h.bookedBy?.phoneNumber || null,
    serviceType: "hotel",
    bookingDate: h.checkInDate || null,
    amount: h.totalAmount || 0,
    paymentStatus: h.paymentStatus || "PENDING",
    createdAt: h.createdAt,
  }));

  const formattedRideBookings = rideBookings.map((r) => ({
    bookingId: r.bookingId || null,
    userId: r.userId?.userId || null,
    fullName: r.userId?.fullName || null,
    email: r.userId?.email || null,
    phone: r.userId?.phoneNumber || null,
    serviceType: "ride",
    bookingDate: r.timestamps?.completedAt || null,
    amount: r.fare || 0,
    paymentStatus: r.paymentStatus || "PENDING",
    createdAt: r.createdAt,
  }));

  // ✅ Merge all bookings
  const allBookings = [
    ...formattedBusBookings,
    ...formattedHotelBookings,
    ...formattedRideBookings,
  ];

  // ✅ Sort
  const sortedBookings = allBookings.sort((a, b) => {
    const aVal = a[sortBy] || 0;
    const bVal = b[sortBy] || 0;
    if (aVal > bVal) return sortOrder;
    if (aVal < bVal) return -sortOrder;
    return 0;
  });

  // ✅ Total + Pagination
  const total = sortedBookings.length;
  const paginatedBookings = sortedBookings.slice(skip, skip + limitNum);

  // ✅ Response
  return res.status(200).json({
    success: true,
    message: "All bookings retrieved successfully",
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

  // build a case-insensitive prefix regex if search present
  const buildSearchQuery = (base = {}) => {
    if (search && search.trim() !== "") {
      base.bookingId = { $regex: `^${search}`, $options: "i" };
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
          bookings: items,
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
        buildSearchQuery({ userId }),
        "Transactions fetched successfully"
      );

    case "all": {
      // each collection uses same search prefix logic
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
        ...busItems.map((d) => ({ ...d, source: "bus" })),
        ...hotelItems.map((d) => ({ ...d, source: "hotel" })),
        ...rideItems.map((d) => ({ ...d, source: "ride" })),
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

module.exports = {
  getAllUsers,
  getSingleUser,
  verifyUserProfile,
  getAllUsersBookings,
  getAllBookingsByUserId,
  getWalletBalance,
};

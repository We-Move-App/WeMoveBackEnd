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
const HotelBookingModel = require("../../../models/hotel-module/hotel-bookings/hotel-bookings.model")
const BusBookingModel = require("../../../models/bus-module/bus-bookings/bus-bookings.model")
const RideBookingDetail = require("../../../models/new-driver-module/booking-details/booking-details.model");
const BusModel = require("../../../models/bus-module/buses/buses.model")

const getAllUsers = catchAsyncError(async (req, res) => {
  const {
    search,              // one global search input
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
      { verificationStatus: regex }   // ✅ added status search
    ];
  }

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
    "fullName phoneNumber email verificationStatus createdAt"
  )
    .skip(skip)
    .limit(limitNum)
    .sort(sort);

  res.status(200).json({
    success: true,
    message: "Users fetched successfully",
    total,
    page: pageNum,
    limit: limitNum,
    sortBy,
    order,
    data,
  });
});


const getSingleUser = catchAsyncError(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10, sortBy = "date", order = "desc" } = req.query;

  const user = await UserModel.findById(userId, "fullName email phoneNumber verificationStatus");
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  // Fetch booking counts
  const [busCount, hotelCount, rideCount] = await Promise.all([
    BusBookingModel.countDocuments({ bookedBy: userId }),
    HotelBookingModel.countDocuments({ bookedBy: userId }),
    RideBookingDetail.countDocuments({ userId: userId }),
  ]);

  // Fetch all bookings without pagination
  const busBookings = await BusBookingModel.find({ bookedBy: userId }, "_id busId routeId journeyDate price status")
    .populate({
      path: "busId",
      select: "busRegNumber routes",
      populate: {
        path: "routes",
        model: "BusRoute",
        select: "routeName startLocation endLocation",
      },
    })
    .populate({
      path: "routeId",
      select: "routeName startLocation endLocation",
    });

  const hotelBookings = await HotelBookingModel.find(
    { bookedBy: userId },
    "_id hotelId checkInDate checkOutDate totalAmount status"
  );

  const rideBookings = await RideBookingDetail.find(
    { userId: userId.toString() },
    "bookingId timestamps.completedAt fare rideStatus"
  );

  // Format bookings
  const formattedBusBookings = busBookings.map((b) => ({
    busBookingId: b._id,
    type: "bus",
    busNumber: b.busId?.busRegNumber || null,
    route: b.routeId
      ? `${b.routeId.startLocation} → ${b.routeId.endLocation}`
      : b.busId?.routes
        ? `${b.busId.routes.startLocation} → ${b.busId.routes.endLocation}`
        : null,
    date: b.journeyDate,
    amount: b.price,
    status: b.status,
  }));

  const formattedHotelBookings = hotelBookings.map((h) => ({
    id: h._id,
    hotelId: h.hotelId,
    type: "hotel",
    date: h.checkInDate,
    stayDuration: `${h.checkInDate.toDateString()} - ${h.checkOutDate.toDateString()}`,
    amount: h.totalAmount,
    status: h.status,
  }));

  const formattedRideBookings = rideBookings.map((r) => ({
    bookingId: r.bookingId,
    type: "ride",
    date: r.timestamps?.completedAt || null,
    amount: r.fare,
    status: r.rideStatus,
  }));

  // Merge all bookings and sort by date
  const allBookingsSorted = [...formattedRideBookings, ...formattedBusBookings, ...formattedHotelBookings].sort(
    (a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return order === "asc" ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date);
    }
  );

  // Apply pagination to merged list
  const totalBookings = allBookingsSorted.length;
  const totalPages = Math.ceil(totalBookings / limit);
  const paginatedAllBookings = allBookingsSorted.slice((page - 1) * limit, page * limit);

  // Final response
  res.status(200).json({
    success: true,
    message: "User profile with bookings fetched successfully",
    personalInfo: {
      id: user._id,
      name: user.fullName,
      email: user.email,
      mobile: user.phoneNumber,
      status: user.verificationStatus,
    },
    bookingSummary: {
      busBookings: busCount,
      hotelBookings: hotelCount,
      rideBookings: rideCount,
    },
    busBookings: formattedBusBookings,
    hotelBookings: formattedHotelBookings,
    rideBookings: formattedRideBookings,
    allBookings: paginatedAllBookings,
    currentPage: parseInt(page),
    total: totalPages,
    totalBookings: totalBookings,
    pageSize: parseInt(limit),
  });
});


const verifyUserProfile = catchAsyncError(async (req, res, next) => {
  const result = await userVerifiedByAdmin({ req, model: UserModel });

  return res.status(statusCode.OK).json(result);
});

const deleteUserPermanently = catchAsyncError(async (req, res, next) => {
  const { userId } = req.params

  const [user, userBank, userDocs] = await Promise.all([
    UserModel.findById(_id),
    UserBankModel.findOne({ userId: _id }),
    UserDocumentModel.findOne({ userId: _id }).populate("documentIds"),
  ]);


})
module.exports = {
  getAllUsers,
  getSingleUser,
  verifyUserProfile,
};

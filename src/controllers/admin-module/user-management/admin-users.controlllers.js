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
const RideBookingDetail= require("../../../models/new-driver-module/booking-details/booking-details.model");
const BusModel = require("../../../models/bus-module/buses/buses.model")
const getAllUsers = catchAsyncError(async (req, res) => {
  const {  name, email, mobile , page=1 , limit=20} = req.query;

  // Build filter object dynamically
  const filter = {};
  if (name) filter.fullName = new RegExp(name, "i"); // case-insensitive
  if (email) filter.email = new RegExp(email, "i");
  if (mobile) filter.phoneNumber = new RegExp(mobile, "i");

  const pageNum = parseInt(page, 10 )||1;
  const limitNum = parseInt(limit,10)|| 10;
  const skip = (pageNum-1)*limitNum;

  const totalCount = await UserModel.countDocuments(filter);
    if (totalCount === 0) {
    return res.status(404).json({
      statusCode: 404,
      success: false,
      message: "User not found",
      data: [],
    });
  }


  const users = await UserModel.find(
    filter,
    "fullName phoneNumber email verificationStatus"
  )
  res.status(200).json({
    statusCode: 200,
    success: true,
    message: "Users fetched successfully",
   pagination:{
    totalCount,
    page: pageNum,
    limit: limitNum,
    totalPage: Math.ceil(totalCount/limitNum)
   },
    userDetails: users,
  });
});
const getSingleUser = catchAsyncError(async (req, res) => {
  const { userId } = req.params;

  // 1. Find user basic info
  const user = await UserModel.findById(userId, "fullName email phoneNumber");
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  // 2. Fetch booking counts
  const [busCount, hotelCount, rideCount] = await Promise.all([
    BusBookingModel.countDocuments({ bookedBy: userId }),
    HotelBookingModel.countDocuments({ bookedBy: userId }),
     RideBookingDetail.countDocuments({ userId: userId }),
  ]);
const busBookings = await BusBookingModel.find(
  { bookedBy: userId },
  "_id busId routeId journeyDate price status"
)
.populate({
  path: "busId",
  select: "busRegNumber routes",   // also fetch routes
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
const formattedBusBookings = busBookings.map((b) => ({
  busBookingId: b._id,
    type: "bus",
  busNumber: b.busId?.busRegNumber || null,
  // Prefer routeId, else fallback to bus.routes
  route: b.routeId 
    ? `${b.routeId.startLocation} → ${b.routeId.endLocation}` 
    : b.busId?.routes 
      ? `${b.busId.routes.startLocation} → ${b.busId.routes.endLocation}`
      : null,
  date: b.journeyDate,
  amount: b.price,
  status: b.status,
}));




  const hotelBookings = await HotelBookingModel.find(
    { bookedBy: userId },
    "_id hotelId checkInDate checkOutDate totalAmount status"
  );

  const formattedHotelBookings = hotelBookings.map((h) => ({
    id: h._id,
    hotelId: h.hotelId,
      type: "hotel",
    stayDuration: `${h.checkInDate.toDateString()} - ${h.checkOutDate.toDateString()}`,
    amount: h.totalAmount,
    status: h.status,
  }));
const rideBookings = await RideBookingDetail.find(
  { userId: userId.toString() },
  "bookingId timestamps.completedAt fare rideStatus"
);

  const formattedRideBookings = rideBookings.map((r) => ({
    bookingId: r.bookingId,
      type: "ride",
    rideDate: r.timestamps?.completedAt || null,
    amount: r.fare,
    status: r.rideStatus,
  }));
    const allBookings = [...formattedRideBookings, ...formattedBusBookings, ...formattedHotelBookings].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  // Final Response
  res.status(200).json({
    success: true,
    message: "User profile with bookings fetched successfully",
    personalInfo: {
      id: user._id,
      name: user.fullName,
      email: user.email,
      mobile: user.phoneNumber,
    },
    bookingSummary: {
      busBookings: busCount,
      hotelBookings: hotelCount,
      rideBookings: rideCount,
    },
    busBookings: formattedBusBookings,
    hotelBookings: formattedHotelBookings,
    rideBookings: formattedRideBookings,
    allBookings: allBookings
  });
});




const verifyUserProfile = catchAsyncError(async (req, res, next) => {
  const result = await userVerifiedByAdmin({ req, model: UserModel });

  return res.status(statusCode.OK).json(result);
});

const deleteUserPermanently = catchAsyncError(async(req,res ,next)=>{
  const {userId} = req.params

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

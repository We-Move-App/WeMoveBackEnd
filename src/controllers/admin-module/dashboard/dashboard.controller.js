const {
  AdminModel,
} = require("../../../models/admin-module/admin/admin.model");
const statusCode = require("../../../utils/constants/statusCode");
const {
  decodeAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const HotelBookingModel = require("../../../models/hotel-module/hotel-bookings/hotel-bookings.model");
const RideBookingModel = require("../../../models/new-driver-module/booking-details/booking-details.model");
const {
  calculateTrend,
  getWeeklyRevenue,
  getYearlyRevenue,
  getMonthlyRevenue,
} = require("./dashboard.aggregations");
const BusBookingModel = require("../../../models/bus-module/bus-bookings/bus-bookings.model");
const { RideBookStatusEnum, PaymentStatusEnum } = require("../../../utils/constants/ENUM");

async function hotelBookings(adminId, filter = "monthly") {
  // ----------------- Step 1: Collect Hotel Booking IDs -----------------
  const hotelBookings = await HotelBookingModel.find({}, { _id: 1 });
  const hotelBookingIds = hotelBookings.map((b) => b._id.toString());

  // ----------------- Step 2: Base Match -----------------
  const matchStage = {
    adminId,
    bookingId: { $in: hotelBookingIds },
    status: "SUCCESS",
  };

  let result = [];
  let trend = null;

  if (filter === "monthly") {
    result = await getMonthlyRevenue(matchStage);
  } else if (filter === "yearly") {
    result = await getYearlyRevenue(matchStage);
  } else if (filter === "weekly") {
    result = await getWeeklyRevenue(matchStage);
  }

  trend = calculateTrend(result);

  return { data: result, trend };
}

async function busBookings(adminId, filter = "monthly") {
  // ----------------- Step 1: Collect Bus Booking IDs -----------------
  const busBookings = await BusBookingModel.find({}, { _id: 1 });
  const busBookingIds = busBookings.map((b) => b._id.toString());

  // ----------------- Step 2: Base Match -----------------
  const matchStage = {
    adminId,
    bookingId: { $in: busBookingIds },
    status: "SUCCESS",
  };

  let result = [];
  let trend = null;

  // ----------------- Step 3: Use Aggregation Helpers -----------------
  if (filter === "monthly") {
    result = await getMonthlyRevenue(matchStage);
  } else if (filter === "yearly") {
    result = await getYearlyRevenue(matchStage);
  } else if (filter === "weekly") {
    result = await getWeeklyRevenue(matchStage);
  }

  // ----------------- Step 4: Trend Calculation -----------------
  trend = calculateTrend(result);

  return { data: result, trend };
}

async function rideBookings(adminId, filter = "monthly") {
  // ----------------- Step 1: Collect Completed Ride IDs -----------------
  const rides = await RideBookingModel.find(
    { rideStatus: RideBookStatusEnum.COMPLETED, paymentStatus: PaymentStatusEnum.SUCCESS },
    { bookingId: 1, vehicleType: 1 }
  );

  const rideIds = rides.map((r) => r.bookingId);

  const vehicleMap = rides.reduce((acc, r) => {
    acc[r.bookingId] = r.vehicleType;
    return acc;
  }, {});

  // ----------------- Step 2: Base Match for Transactions -----------------
  const matchStageBase = {
    adminId,
    bookingId: { $in: rideIds },
    status: "SUCCESS", // ✅ transaction status
  };

  // ----------------- Step 3: Helper to Get Data per Vehicle -----------------
  async function getDataForVehicle(vehicleType) {
    // filter only rides of this type
    const vehicleRideIds = Object.entries(vehicleMap)
      .filter(([_, v]) => v === vehicleType)
      .map(([id]) => id);

    if (vehicleRideIds.length === 0) {
      return { data: [], trend: null };
    }

    const matchStage = {
      ...matchStageBase,
      bookingId: { $in: vehicleRideIds },
    };

    let result = [];
    if (filter === "monthly") {
      result = await getMonthlyRevenue(matchStage, "amount");
    } else if (filter === "yearly") {
      result = await getYearlyRevenue(matchStage, "amount");
    } else if (filter === "weekly") {
      result = await getWeeklyRevenue(matchStage, "amount");
    }

    const trend = calculateTrend(result);
    return { data: result, trend };
  }

  // ----------------- Step 4: Run for Both Vehicle Types -----------------
  const bikeData = await getDataForVehicle("bike");
  const taxiData = await getDataForVehicle("taxi");

  return {
    bike: bikeData,
    taxi: taxiData,
  };
}

async function validateToken(accessToken) {
  const decoded = decodeAccessToken(accessToken);
  const userId = decoded?._id;

  if (!userId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const admin = await AdminModel.findById(userId);
  if (!admin) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  return decoded;
}

// TODO : permissions based res

const getTopAnalytics = catchAsyncError(async (req, res) => {
  // ----------------- Step 1: Token Validation -----------------
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = await validateToken(accessToken);

  const { permissions } = decoded;

  // ----------------- Step 2: Fetch Data Based on Permissions -----------------
  const analyticsData = {};
  const adminId="ADM001" // TODO need to change

  if (permissions?.hotelManagement) {
    analyticsData.hotel = await hotelBookings(adminId, "weekly");
  }

  if (permissions?.busManagement) {
    analyticsData.bus = await busBookings(adminId, "weekly");
  }

  if (permissions?.taxiManagement || permissions?.bikeManagement) {
    // rideBookings already splits by bike/taxi inside
    const rideData = await rideBookings(adminId, "weekly");

    if (permissions?.bikeManagement) {
      analyticsData.bike = rideData.bike;
    }
    if (permissions?.taxiManagement) {
      analyticsData.taxi = rideData.taxi;
    }
  }

  // ----------------- Step 3: Response -----------------
  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      analyticsData,
      "Data fetched successfully"
    )
  );
});

module.exports = { getTopAnalytics };

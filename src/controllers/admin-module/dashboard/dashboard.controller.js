const moment = require("moment");
const Transaction = require("../../../models/transaction-module/transaction.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  decodeAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const BusOperatorModel = require("../../../models/bus-module/bus-operator/bus-operator.model");
const HotelManagerModel = require("../../../models/hotel-module/hotel-manager/hotel-manager.model");
const RideBookingModel = require("../../../models/new-driver-module/booking-details/booking-details.model");
const DriverBasicDetailsModel = require("../../../models/new-driver-module/basic-details/basic-details.model");
const UserModel = require("../../../models/user-module/users/user.model");

// More than 100 needed then
// function calcTrend(current, previous) {
//   const trend = ((current - previous) / (previous || 1)) * 100;
//   return {
//     trend: Number(trend.toFixed(2)),
//     status: trend >= 0 ? "increased" : "decreased",
//   };
// }

// 0 - 100 only
function calcTrend(current, previous) {
  if (previous === 0 && current === 0) {
    return { trend: 0, status: "no change" };
  }

  const rawTrend = ((current - previous) / (previous || 1)) * 100;
  const cappedTrend = Math.max(-100, Math.min(100, rawTrend)); // clamp between -100 and 100

  return {
    trend: Number(cappedTrend.toFixed(2)),
    status:
      cappedTrend > 0
        ? "increased"
        : cappedTrend < 0
          ? "decreased"
          : "no change",
  };
}

function calcTrendOthers(previous, current) {
  if (previous === 0 && current === 0) {
    return { trend: 0, status: "no change" };
  }

  // raw growth %
  const rawTrend = ((current - previous) / (previous || 1)) * 100;

  return {
    trend: Number(Math.abs(rawTrend).toFixed(2)), // always positive
    status:
      rawTrend > 0 ? "increased" : rawTrend < 0 ? "decreased" : "no change",
  };
}

function getBuckets(filter) {
  if (filter === "monthly") {
    const currentMonth = moment().month(); // 0 = Jan, 8 = Sep (current)
    return moment.months().slice(0, currentMonth + 1); // up to current month
  }

  if (filter === "yearly") {
    const years = [];
    const thisYear = moment().year();
    for (let i = thisYear - 4; i <= thisYear; i++) years.push(String(i));
    return years; // already limited, so no change needed
  }

  if (filter === "weekly") {
    const start = moment().startOf("month");
    const today = moment();
    const weeks = [];
    let weekIndex = 1;
    let cursor = start.clone();

    while (cursor.isBefore(today, "day")) {
      weeks.push(`week${weekIndex}`);
      cursor.add(7, "days");
      weekIndex++;
    }

    return weeks; // only weeks that have started
  }

  throw new Error("Invalid filter");
}

function getBucketKey(date, filter) {
  if (filter === "monthly") {
    return moment(date).format("MMMM"); // e.g., "January"
  }
  if (filter === "yearly") {
    return moment(date).format("YYYY");
  }
  if (filter === "weekly") {
    const start = moment().startOf("month");
    const diff = moment(date).diff(start, "days");
    return `week${Math.floor(diff / 7) + 1}`;
  }
  return null;
}

async function analyticsSuperAdmin(filter) {
  // Step 1: Get all transactions for relevant period
  let startDate, endDate;

  if (filter === "monthly") {
    startDate = moment().startOf("year").toDate();
    endDate = moment().endOf("year").toDate();
  } else if (filter === "yearly") {
    startDate = moment().subtract(4, "years").startOf("year").toDate();
    endDate = moment().endOf("year").toDate();
  } else if (filter === "weekly") {
    startDate = moment().startOf("month").toDate();
    endDate = moment().endOf("month").toDate();
  } else {
    throw new Error("Invalid filter");
  }

  const txns = await Transaction.find({
    createdAt: { $gte: startDate, $lte: endDate },
  }).lean();

  const buckets = getBuckets(filter);

  // Step 2: Build metrics per bucket
  const results = {
    hotel: [],
    bus: [],
    taxi: [],
    bike: [],
    totalBookings: [],
    completed: [],
    cancelled: [],
    revenue: {
      hotelManager: [],
      busOperator: [],
      taxiDriver: [],
      bikeDriver: [],
      admin: [],
      totalRevenue: [],
    },
  };

  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];

    const bucketTxns = txns.filter(
      (t) => getBucketKey(t.createdAt, filter) === bucket
    );

    // ---- Booking Counts ----
    const hotelBookings = new Set(
      bucketTxns.filter((t) => t.hotelManagerId).map((t) => t.bookingId)
    );
    const busBookings = new Set(
      bucketTxns.filter((t) => t.busOperatorId).map((t) => t.bookingId)
    );

    // Taxi & Bike → check RideBookingModel for vehicleType
    const driverTxns = bucketTxns.filter((t) => t.driverId);
    const taxiBookings = new Set();
    const bikeBookings = new Set();

    for (const txn of driverTxns) {
      if (!txn.bookingId) continue;
      const ride = await RideBookingModel.findOne(
        { bookingId: txn.bookingId },
        { vehicleType: 1 }
      ).lean();
      if (!ride) continue;

      if (ride.vehicleType === "bike") bikeBookings.add(txn.bookingId);
      if (ride.vehicleType === "taxi") taxiBookings.add(txn.bookingId);
    }

    const totalBookings = new Set([
      ...hotelBookings,
      ...busBookings,
      ...taxiBookings,
      ...bikeBookings,
    ]);

    const cancelled = new Set(
      bucketTxns.filter((t) => t.refund === true).map((t) => t.bookingId)
    );
    const completed = new Set(
      [...totalBookings].filter((id) => !cancelled.has(id))
    );

    // ---- Revenue ----
    const calcRevenue = (txns, key) =>
      txns
        .filter((t) => t[key])
        .reduce((sum, t) => {
          if (t.type === "CREDIT") return sum + t.amount;
          if (t.type === "DEBIT" && t.refund) return sum - t.amount;
          return sum;
        }, 0);

    const hotelRevenue = calcRevenue(bucketTxns, "hotelManagerId");
    const busRevenue = calcRevenue(bucketTxns, "busOperatorId");

    // Bike & Taxi revenues (driverId != null + check vehicleType)
    let bikeRevenue = 0;
    let taxiRevenue = 0;

    for (const txn of driverTxns) {
      if (!txn.bookingId) continue;
      const ride = await RideBookingModel.findOne(
        { bookingId: txn.bookingId },
        { vehicleType: 1 }
      ).lean();
      if (!ride) continue;

      if (ride.vehicleType === "bike") {
        if (txn.type === "CREDIT") bikeRevenue += txn.amount;
        if (txn.type === "DEBIT" && txn.refund) bikeRevenue -= txn.amount;
      }
      if (ride.vehicleType === "taxi") {
        if (txn.type === "CREDIT") taxiRevenue += txn.amount;
        if (txn.type === "DEBIT" && txn.refund) taxiRevenue -= txn.amount;
      }
    }

    const adminRevenue = bucketTxns
      .filter((t) => t.adminId && t.type === "CREDIT")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalRevenue =
      hotelRevenue + busRevenue + adminRevenue + bikeRevenue + taxiRevenue;

    // ---- Previous values for trend ----
    const prevHotel = results.hotel[i - 1]?.bookings || 0;
    const prevBus = results.bus[i - 1]?.bookings || 0;
    const prevTaxi = results.taxi[i - 1]?.bookings || 0;
    const prevBike = results.bike[i - 1]?.bookings || 0;
    const prevTotal = results.totalBookings[i - 1]?.bookings || 0;
    const prevCancelled = results.cancelled[i - 1]?.bookings || 0;
    const prevCompleted = results.completed[i - 1]?.bookings || 0;
    const prevHotelRev = results.revenue.hotelManager[i - 1]?.amount || 0;
    const prevBusRev = results.revenue.busOperator[i - 1]?.amount || 0;
    const prevTaxiRev = results.revenue.taxiDriver[i - 1]?.amount || 0;
    const prevBikeRev = results.revenue.bikeDriver[i - 1]?.amount || 0;
    const prevAdminRev = results.revenue.admin[i - 1]?.amount || 0;
    const prevTotalRev = results.revenue.totalRevenue[i - 1]?.amount || 0;

    // ---- Push to results ----
    results.hotel.push({
      filter: bucket,
      bookings: hotelBookings.size,
      ...calcTrend(hotelBookings.size, prevHotel),
    });
    results.bus.push({
      filter: bucket,
      bookings: busBookings.size,
      ...calcTrend(busBookings.size, prevBus),
    });
    results.taxi.push({
      filter: bucket,
      bookings: taxiBookings.size,
      ...calcTrend(taxiBookings.size, prevTaxi),
    });
    results.bike.push({
      filter: bucket,
      bookings: bikeBookings.size,
      ...calcTrend(bikeBookings.size, prevBike),
    });
    results.totalBookings.push({
      filter: bucket,
      bookings: totalBookings.size,
      ...calcTrend(totalBookings.size, prevTotal),
    });
    results.cancelled.push({
      filter: bucket,
      bookings: cancelled.size,
      ...calcTrend(cancelled.size, prevCancelled),
    });
    results.completed.push({
      filter: bucket,
      bookings: completed.size,
      ...calcTrend(completed.size, prevCompleted),
    });
    results.revenue.hotelManager.push({
      filter: bucket,
      amount: hotelRevenue,
      ...calcTrend(hotelRevenue, prevHotelRev),
    });
    results.revenue.busOperator.push({
      filter: bucket,
      amount: busRevenue,
      ...calcTrend(busRevenue, prevBusRev),
    });
    results.revenue.taxiDriver.push({
      filter: bucket,
      amount: taxiRevenue,
      ...calcTrend(taxiRevenue, prevTaxiRev),
    });
    results.revenue.bikeDriver.push({
      filter: bucket,
      amount: bikeRevenue,
      ...calcTrend(bikeRevenue, prevBikeRev),
    });
    results.revenue.admin.push({
      filter: bucket,
      amount: adminRevenue,
      ...calcTrend(adminRevenue, prevAdminRev),
    });
    results.revenue.totalRevenue.push({
      filter: bucket,
      amount: totalRevenue,
      ...calcTrend(totalRevenue, prevTotalRev),
    });
  }

  return results;
}

async function analyticsOthers(branchId, permissions, filter) {
  let busOperators = [];
  let hotelManagers = [];
  let drivers = [];

  // ----------------- Step 1: Get Bus Operators & Hotel Managers -----------------
  if (permissions.busManagement) {
    busOperators = await BusOperatorModel.find(
      { branch: branchId },
      "_id"
    ).lean();
    busOperators = busOperators.map((b) => b._id.toString());
  }

  if (permissions.hotelManagement) {
    hotelManagers = await HotelManagerModel.find(
      { branch: branchId },
      "_id"
    ).lean();
    hotelManagers = hotelManagers.map((h) => h._id.toString());
  }

  // ----------------- Step 2: Get Drivers (for Taxi & Bike) -----------------
  drivers = await DriverBasicDetailsModel.find(
    { branch: branchId },
    "driverId"
  ).lean();
  drivers = drivers.map((d) => d.driverId); // NOTE: driverId is string

  // ----------------- Step 3: Date Range -----------------
  let startDate, endDate;
  if (filter === "yearly") {
    startDate = moment().startOf("year").toDate();
    endDate = moment().endOf("year").toDate();
  } else if (filter === "monthly" || filter === "weekly") {
    startDate = moment().startOf("month").toDate();
    endDate = moment().endOf("month").toDate();
  } else {
    throw new Error("Invalid filter");
  }

  // ----------------- Step 4: Fetch Transactions -----------------
  const txns = await Transaction.find({
    createdAt: { $gte: startDate, $lte: endDate },
  }).lean();

  // ----------------- Step 5: Buckets -----------------
  const buckets = getBuckets(filter);

  const hotel = [];
  const bus = [];
  const taxi = [];
  const bike = [];
  const totalBookings = [];
  const completed = [];
  const cancelled = [];

  // Cache for bookingId → vehicleType to avoid multiple DB calls
  const bookingVehicleMap = {};

  for (const bucket of buckets) {
    const hotelBookings = new Set();
    const busBookings = new Set();
    const taxiBookings = new Set();
    const bikeBookings = new Set();
    const cancelledBookings = new Set();

    for (const txn of txns) {
      const key = getBucketKey(txn.createdAt, filter);
      if (key !== bucket) continue;

      // -------- Hotel ----------
      if (
        permissions.hotelManagement &&
        txn.hotelManagerId &&
        hotelManagers.includes(txn.hotelManagerId.toString())
      ) {
        hotelBookings.add(txn.bookingId);
        if (txn.refund) cancelledBookings.add(txn.bookingId);
      }

      // -------- Bus ----------
      if (
        permissions.busManagement &&
        txn.busOperatorId &&
        busOperators.includes(txn.busOperatorId.toString())
      ) {
        busBookings.add(txn.bookingId);
        if (txn.refund) cancelledBookings.add(txn.bookingId);
      }

      // -------- Taxi / Bike ----------
      if (txn.driverId && drivers.includes(txn.driverId)) {
        let vehicleType = bookingVehicleMap[txn.bookingId];
        if (!vehicleType) {
          const booking = await RideBookingModel.findOne(
            { bookingId: txn.bookingId },
            "vehicleType"
          ).lean();
          vehicleType = booking?.vehicleType;
          bookingVehicleMap[txn.bookingId] = vehicleType; // cache it
        }

        if (vehicleType === "taxi") {
          taxiBookings.add(txn.bookingId);
          if (txn.refund) cancelledBookings.add(txn.bookingId);
        } else if (vehicleType === "bike") {
          bikeBookings.add(txn.bookingId);
          if (txn.refund) cancelledBookings.add(txn.bookingId);
        }
      }
    }

    const hotelCount = hotelBookings.size;
    const busCount = busBookings.size;
    const taxiCount = taxiBookings.size;
    const bikeCount = bikeBookings.size;
    const totalCount = new Set([
      ...hotelBookings,
      ...busBookings,
      ...taxiBookings,
      ...bikeBookings,
    ]).size;

    const cancelledCount = cancelledBookings.size;
    const completedCount = totalCount - cancelledCount;

    if (permissions.hotelManagement)
      hotel.push({ filter: bucket, bookings: hotelCount });
    if (permissions.busManagement)
      bus.push({ filter: bucket, bookings: busCount });
    taxi.push({ filter: bucket, bookings: taxiCount });
    bike.push({ filter: bucket, bookings: bikeCount });

    totalBookings.push({ filter: bucket, bookings: totalCount });
    cancelled.push({ filter: bucket, bookings: cancelledCount });
    completed.push({ filter: bucket, bookings: completedCount });
  }

  // ----------------- Step 6: Trends -----------------
  function attachTrend(arr) {
    if (arr.length === 0) return;
    for (let i = 1; i < arr.length; i++) {
      const { trend, status } = calcTrendOthers(
        arr[i - 1].bookings,
        arr[i].bookings
      );
      arr[i].trend = trend;
      arr[i].status = status;
    }
    arr[0].trend = 0;
    arr[0].status = "nochange";
  }

  if (permissions.hotelManagement) attachTrend(hotel);
  if (permissions.busManagement) attachTrend(bus);
  attachTrend(taxi);
  attachTrend(bike);
  attachTrend(totalBookings);
  attachTrend(completed);
  attachTrend(cancelled);

  // ----------------- Step 7: Response -----------------
  const response = {};
  if (permissions.hotelManagement) response.hotel = hotel;
  if (permissions.busManagement) response.bus = bus;
  if (permissions.taxiManagement) response.taxi = taxi;
  if (permissions.bikeManagement) response.bike = bike;

  response.totalBookings = totalBookings;
  response.completed = completed;
  response.cancelled = cancelled;

  return response;
}

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
  const decoded = decodeAccessToken(accessToken);

  const filter = req.query.filter || "monthly";

  let result = {};
  if (decoded?.role == "SuperAdmin") {
    result = await analyticsSuperAdmin(filter);
  } else {
    result = await analyticsOthers(
      decoded?.branch,
      decoded?.permissions,
      filter
    );
  }
  // ----------------- Step 3: Response -----------------
  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, result, "Data fetched successfully"));
});

const getTotalCounts = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);

  const userCount = await UserModel.countDocuments();
  const busOperatorsCount = await BusOperatorModel.countDocuments();
  const hotelManagerCount = await HotelManagerModel.countDocuments();
  const driversCount = await DriverBasicDetailsModel.countDocuments();

  const result = {
    users: userCount,
    busOperators: busOperatorsCount,
    hotelManagers: hotelManagerCount,
    drivers: driversCount,
  };

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, result, "Count fetched"));
});

module.exports = { getTopAnalytics, getTotalCounts };

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
    totalBookings: [],
    completed: [],
    cancelled: [],
    revenue: {
      hotelManager: [],
      busOperator: [],
      admin: [],
      totalRevenue: [],
    },
  };

  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];
    const prevBucket = buckets[i - 1];

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
    const totalBookings = new Set([...hotelBookings, ...busBookings]);

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
    const adminRevenue = bucketTxns
      .filter((t) => t.adminId && t.type === "CREDIT")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalRevenue = hotelRevenue + busRevenue + adminRevenue;

    // ---- Previous values for trend ----
    const prevHotel = results.hotel[i - 1]?.bookings || 0;
    const prevBus = results.bus[i - 1]?.bookings || 0;
    const prevTotal = results.totalBookings[i - 1]?.bookings || 0;
    const prevCancelled = results.cancelled[i - 1]?.bookings || 0;
    const prevCompleted = results.completed[i - 1]?.bookings || 0;
    const prevHotelRev = results.revenue.hotelManager[i - 1]?.amount || 0;
    const prevBusRev = results.revenue.busOperator[i - 1]?.amount || 0;
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

  // step 2: date range
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

  // step 3: fetch transactions
  const txns = await Transaction.find({
    createdAt: { $gte: startDate, $lte: endDate },
  }).lean();

  // step 4: buckets
  const buckets = getBuckets(filter);

  const hotel = [];
  const bus = [];
  const totalBookings = [];
  const completed = [];
  const cancelled = [];

  for (const bucket of buckets) {
    const hotelBookings = new Set();
    const busBookings = new Set();
    const cancelledBookings = new Set();

    for (const txn of txns) {
      const key = getBucketKey(txn.createdAt, filter);
      if (key !== bucket) continue;

      if (
        txn.hotelManagerId &&
        hotelManagers.includes(txn.hotelManagerId.toString())
      ) {
        hotelBookings.add(txn.bookingId);
        if (txn.refund) cancelledBookings.add(txn.bookingId);
      }
      if (
        txn.busOperatorId &&
        busOperators.includes(txn.busOperatorId.toString())
      ) {
        busBookings.add(txn.bookingId);
        if (txn.refund) cancelledBookings.add(txn.bookingId);
      }
    }

    const hotelCount = hotelBookings.size;
    const busCount = busBookings.size;
    const totalCount = new Set([...hotelBookings, ...busBookings]).size;
    const cancelledCount = cancelledBookings.size;
    const completedCount = totalCount - cancelledCount;

    hotel.push({ filter: bucket, bookings: hotelCount });
    bus.push({ filter: bucket, bookings: busCount });
    totalBookings.push({ filter: bucket, bookings: totalCount });
    cancelled.push({ filter: bucket, bookings: cancelledCount });
    completed.push({ filter: bucket, bookings: completedCount });
  }

  // step 5: add trends
  function attachTrend(arr) {
    for (let i = 1; i < arr.length; i++) {
      const { trend, status } = calcTrendOthers(
        arr[i - 1].bookings,
        arr[i].bookings
      );
      arr[i].trend = trend;
      arr[i].status = status;
    }
    // no trend for first bucket
    arr[0].trend = 0;
    arr[0].status = "nochange";
  }

  attachTrend(hotel);
  attachTrend(bus);
  attachTrend(totalBookings);
  attachTrend(completed);
  attachTrend(cancelled);

  console.log("busOperators :", busOperators, "hotelManagers :", hotelManagers);

  // step 6: return
  return { hotel, bus, totalBookings, completed, cancelled };
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

module.exports = { getTopAnalytics };

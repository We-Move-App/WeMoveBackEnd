const ApiResponse = require("../../../utils/response/ApiResponse");
const ApiError = require("../../../utils/response/ApiError");
const BusBookingModel = require("../../../models/bus-module/bus-bookings/bus-bookings.model");
const statusCode = require("../../../utils/constants/statusCode");
const { getDateRange } = require("../../../utils/reqFunctions/reqFunction");
const BusModel = require("../../../models/bus-module/buses/buses.model");

const getMostBookedBuses = async (req, res) => {
  const { filter = "daily" } = req.query;
  const dateRange = getDateRange(filter);

  const operatorId =
    typeof req.user._id === "string"
      ? new mongoose.Types.ObjectId(req.user._id)
      : req.user._id;

  // STEP 1: Get all bus IDs owned by this operator
  const operatorBuses = await BusModel.find({ ownerId: operatorId }).select(
    "_id"
  );
  const busIds = operatorBuses.map((bus) => bus._id);

  // Step 1: Build match query with date range
  const matchQuery = {
    status: { $in: ["Booked", "Completed"] },
    busId: { $in: busIds },
  };

  if (dateRange) {
    matchQuery.createdAt = {
      $gte: dateRange.startDate,
      $lte: dateRange.endDate,
    };
  }

  const totalBookings = await BusBookingModel.countDocuments(matchQuery);
  if (totalBookings === 0) {
    console.info(`[INFO] No bookings found for filter: ${filter}`);
    return res
      .status(statusCode.OK)
      .json(new ApiResponse(statusCode.OK, [], "No bookings in this period"));
  }

  const results = await BusBookingModel.aggregate([
    {
      $match: matchQuery,
    },
    {
      $group: {
        _id: "$busId",
        totalBookings: { $sum: 1 },
      },
    },
    {
      $addFields: {
        bookingPercentage: {
          $multiply: [{ $divide: ["$totalBookings", totalBookings] }, 100],
        },
      },
    },
    {
      $sort: { totalBookings: -1 },
    },
    {
      $lookup: {
        from: "buses",
        localField: "_id",
        foreignField: "_id",
        as: "busDetails",
      },
    },
    {
      $unwind: "$busDetails",
    },
    {
      $project: {
        _id: 0,
        busId: "$_id",
        busName: "$busDetails.busName",
        busRegNumber: "$busDetails.busRegNumber",
        busModelNumber: "$busDetails.busModelNumber",
        totalBookings: 1,
        bookingPercentage: { $round: ["$bookingPercentage", 2] },
      },
    },
  ]);

  if (!results || results.length === 0) {
    console.warn(
      `[INFO] Aggregation returned empty for filter: ${filter}, Total Bookings: ${totalBookings}`
    );
    throw new ApiError(statusCode.NOT_FOUND, "No data found in aggregation");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, results, "Most booked buses retrieved")
    );
};

module.exports = { getMostBookedBuses };

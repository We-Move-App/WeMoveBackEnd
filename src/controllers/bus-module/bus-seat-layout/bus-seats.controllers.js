const statusCode = require("../../../utils/constants/statusCode");
const {
  getTodayNormalized,
} = require("../../../utils/reqFunctions/reqFunction");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const cron = require("node-cron");
const moment = require("moment");
const { normalizeDate } = require("../../../utils/reqFunctions/reqFunction");
const BusModel = require("../../../models/bus-module/buses/buses.model");
const BusSeatsLayoutModel = require("../../../models/bus-module/bus-seats-management/buses-seats.model");
const BusRouteModel = require("../../../models/bus-module/bus-routes/bus-routes.model");

const createBusSeat = catchAsyncError(async (req, res, next) => {
  const busId = req.params.id;
  const { noOfSeats } = req.body;

  if (!busId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Bus ID is required");
  } 

  const journeyDateNormalized = getTodayNormalized();

  // Check if seat layout already exists for this bus on the same journey date
  const existingSeatLayout = await BusSeatsLayoutModel.findOne({
    busId,
    journeyDate: journeyDateNormalized,
  });

  if (existingSeatLayout) {
    throw new ApiError(
      statusCode.CONFLICT,
      "Seat layout already created for this date"
    );
  }

  // Find the bus and check if it exists
  const findBus = await BusModel.findById(busId).select("_id noOfSeats");
  if (!findBus) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus not found");
  }

  // Find the bus route and ensure it exists
  const findRoute = await BusRouteModel.findOne({ busId }).select("_id");
  if (!findRoute) {
    throw new ApiError(statusCode.NOT_FOUND, "No routes found for this bus");
  }

  // Count booked seats for this bus on the journey date
  const bookedSeatsCount = await BusSeatsLayoutModel.countDocuments({
    busId,
    journeyDate: journeyDateNormalized,
    "seats.status": "booked",
  });

  const availableSeatsCount = noOfSeats - bookedSeatsCount;

  // Create seat layout
  const busSeats = Array.from({ length: noOfSeats }, (_, i) => ({
    seatNumber: `S${i + 1}`,
    isAvailable: true,
    seatType: "regular",
    status: "available",
  }));

  // Save new seat layout
  const newSeatLayout = await BusSeatsLayoutModel.create({
    busId,
    routeId: findRoute._id,
    seats: busSeats,
    noOfSeats,
    bookedSeats: bookedSeatsCount,
    availableSeats: availableSeatsCount,
    journeyDate: journeyDateNormalized,
    createdBy: req.user._id,
  });

  // Save updated seat count in bus model
  findBus.noOfSeats = noOfSeats;
  findRoute.seats = newSeatLayout._id;
  await findBus.save();
  await findRoute.save();

  return res.status(statusCode.CREATED).json(
    new ApiResponse(
      statusCode.CREATED,
      {
        newSeatLayout,
        bookedSeats: bookedSeatsCount,
        availableSeats: availableSeatsCount,
      },
      "Bus seat layouts processed successfully"
    )
  );
});

const getSingleBusSeatDetails = catchAsyncError(async (req, res, next) => {
  const { busId, seatId } = req.params;

  if (!busId || !seatId) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Bus ID and Seat ID are required"
    );
  }

  // Verify the bus exists
  const findBus = await BusModel.findById(busId).select("_id");
  if (!findBus) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus not found");
  }

  // Fetch the bus seat document by busId
  const busSeat = await BusSeatsLayoutModel.findOne({ busId }).populate({
    path: "seats.bookingReference",
    model: "BusBooking",
  });
  if (!busSeat) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus seat data not found");
  }

  // Find the specific seat in the seats array
  let seat = busSeat.seats.find((s) => s._id.toString() === seatId.toString());
  if (!seat) {
    throw new ApiError(statusCode.NOT_FOUND, "Seat not found");
  }

  res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        seat,
        "Bus seat details retrieved successfully"
      )
    );
});

const getBusAllSeats = catchAsyncError(async (req, res, next) => {
  const { busId, date, routeId } = req.query;

  if (!busId || !date || !routeId) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Bus ID, routeId and journey date  is required"
    );
  }

  const bus = await BusModel.findById(busId).select("_id");
  if (!bus) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus not found");
  }

  const route = await BusRouteModel.findById(routeId).select("_id");
  if (!route) {
    throw new ApiError(statusCode.NOT_FOUND, "Route not found");
  }

  const journeyDateNormalized = normalizeDate(date);

  const busSeats = await BusSeatsLayoutModel.findOne({
    busId,
    journeyDate: journeyDateNormalized,
    routeId,
  });
  if (!busSeats) {
    throw new ApiError(statusCode.CONFLICT, "No seat found");
  }

  const data = {
    busSeats,
  };

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, data, "Bus seats retrieved successfully")
    );
});

const deleteSeats = catchAsyncError(async (req, res, next) => {
  const { busId, seatId } = req.query;

  if (!busId || !seatId) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Bus ID and journey date are required"
    );
  }
  const bus = await BusModel.findById(busId);
  if (!bus) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus not found");
  }

  const deletedSeat = await BusSeatsLayoutModel.findOneAndDelete({
    busId,
    _id: seatId,
  });

  if (!deletedSeat) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "No seats found for the given journey date"
    );
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, null, "Bus seats deleted successfully")
    );
});
const deleteOldSeats = async () => {
  try {
    const cutoffDate = moment().subtract(2, "days").startOf("day").toDate(); // Ensuring midnight local time

    const result = await BusSeatsLayoutModel.deleteMany({
      journeyDate: { $lt: cutoffDate }, 
      journeyComplete: true
    });

    console.log(
      `[Cron] Deleted ${result.deletedCount} old bus seat record(s) (journeyDate < ${cutoffDate.toISOString()})`
    );
  } catch (error) {
    console.error("[Cron] Error deleting old bus seats:", error);
  }
};

// Schedule the cron job to run every day at midnight
cron.schedule("0 0 * * *", () => {
  console.log("[Cron] Running nightly deletion job at midnight");
  deleteOldSeats();
});

module.exports = {
  createBusSeat,
  getSingleBusSeatDetails,
  getBusAllSeats,
  deleteSeats,
};

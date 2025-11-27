const BusRouteModel = require("../../../models/bus-module/bus-routes/bus-routes.model");
const BusModel = require("../../../models/bus-module/buses/buses.model");
const statusCode = require("../../../utils/constants/statusCode");
const {
  validateRequestBody,
} = require("../../../utils/reqFunctions/reqFunction");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const mongoose = require("mongoose");
const { getFinalPrice } = require("../../../utils/services/prices.services");
const moment = require("moment");

// =============|| CREATE BUS ROUTE ||=============================

const createBusRoute = catchAsyncError(async (req, res, next) => {
  const {
    busId,
    startLocation,
    endLocation,
    departureTime,
    arrivalTime,
    pricePerSeat,
    pickups,
    drops,
    routeName,
  } = req.body;

  const { _id } = req.user;

  const reqFiled = [
    "busId",
    "startLocation",
    "endLocation",
    "departureTime",
    "arrivalTime",
    "pricePerSeat",
  ];

  validateRequestBody(reqFiled, req.body);

  if (startLocation.trim().toLowerCase() === endLocation.trim().toLowerCase()) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Start and end locations cannot be the same"
    );
  }
  if (
    !Array.isArray(pickups) ||
    pickups.length === 0 ||
    !Array.isArray(drops) ||
    drops.length === 0
  ) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Pickup and drop fields are required as arrays"
    );
  }

  // Check if bus exists
  const findBus = await BusModel.findById(busId);
  if (!findBus) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus not found");
  }
  const query = {
    busId,
  };

  // Check for duplicate routes (same start, end, and time)
  const existingRoute = await BusRouteModel.findOne(query);

  if (existingRoute) {
    throw new ApiError(
      statusCode.CONFLICT,
      "A route already exist for this bus"
    );
  }

  const newRoute = new BusRouteModel({
    busId,
    startLocation,
    endLocation,
    departureTime,
    arrivalTime,
    pricePerSeat,
    pickups: pickups,
    drops: drops,
    createdBy: _id,
    busRegNumber: findBus.busRegNumber,
    runningDays: findBus.runningDays,
    routeName,
  });
  await newRoute.save();
  findBus.routes = newRoute._id;
  await findBus.save();

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        newRoute,
        "Bus route created successfully"
      )
    );
});

// =============|| UPDATE BUS ROUTE ||=============================

const updateBusRoute = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const {
    busId,
    startLocation,
    endLocation,
    departureTime,
    arrivalTime,
    // pricePerSeat,
    pickups,
    drops,
    routeName,
  } = req.body;
  console.log("id:", req.body);

  const { _id } = req.user;

  const reqFields = [
    "busId",
    "startLocation",
    "endLocation",
    "departureTime",
    "arrivalTime",
    // "pricePerSeat",
  ];

  validateRequestBody(reqFields, req.body);

  if (startLocation.trim().toLowerCase() === endLocation.trim().toLowerCase()) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Start and end locations cannot be the same"
    );
  }

  if (
    !Array.isArray(pickups) ||
    pickups.length === 0 ||
    !Array.isArray(drops) ||
    drops.length === 0
  ) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Pickup and drop fields are required as arrays"
    );
  }

  // Check if bus exists
  const findBus = await BusModel.findById(busId);
  if (!findBus) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus not found");
  }

  // Check if route exists
  const existingRoute = await BusRouteModel.findById(id);
  if (!existingRoute) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus route not found");
  }

  // Check for duplicate route
  const duplicateRoute = await BusRouteModel.findOne({
    _id: { $ne: id }, // Exclude current route
    busId,
    startLocation,
    endLocation,
    departureTime,
    arrivalTime,
    pickups,
    drops,
    routeName,
  });

  if (duplicateRoute) {
    throw new ApiError(
      statusCode.CONFLICT,
      "A route with the same start, end, and time already exists"
    );
  }

  // Update route
  Object.assign(existingRoute, {
    startLocation,
    endLocation,
    departureTime,
    arrivalTime,
    // pricePerSeat,
    updatedBy: _id,
    pickups,
    routeName,
    drops,
  });

  await existingRoute.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        existingRoute,
        "Bus route updated successfully"
      )
    );
});

// =============|| DELETE BUS ROUTE ||=============================
const deleteBusRoute = catchAsyncError(async (req, res, next) => {
  const { routeId } = req.params;

  // Find the route by ID
  const existingRoute = await BusRouteModel.findById(routeId);
  if (!existingRoute) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus route not found");
  }

  // Find the associated bus
  const findBus = await BusModel.findById(existingRoute.busId);
  if (findBus) {
    // Remove route ID from bus routes array
    findBus.routes = undefined;
    await findBus.save();
  }

  // Delete the bus route
  await BusRouteModel.findByIdAndDelete(routeId);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, null, "Bus route deleted successfully")
    );
});

// =============|| GET ALL BUS ROUTES ||=============================
const getAllBusRoutes = catchAsyncError(async (req, res, next) => {
  const { busId } = req.params;

  const busRoutes = await BusRouteModel.find({ busId });
  console.log("Bus Routes:", busRoutes);

  if (!busRoutes || busRoutes.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus routes not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        busRoutes,
        "Bus routes retrieved successfully"
      )
    );
});
// =============|| GET ALL BUS ROUTES ||=============================
const getSingleBusRoutes = catchAsyncError(async (req, res, next) => {
  const { routeId } = req.params;

  const busRoutes = await BusRouteModel.findById(routeId);

  if (!busRoutes) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus route not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        busRoutes,
        "Bus routes retrieved successfully"
      )
    );
});
// =============|| GET ALL BUS ROUTES ||=============================
const getSingleBusRoutesByBusId = catchAsyncError(async (req, res, next) => {
  const { busId } = req.params;

  const busRoutes = await BusRouteModel.findOne({ busId: busId });

  if (!busRoutes) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus route not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        busRoutes,
        "Bus routes retrieved successfully"
      )
    );
});

// ======================|| ADD PICKUPS AND DROP TO ROUTE ||=========================
const addPickupDropToRoute = catchAsyncError(async (req, res, next) => {
  const { routeId } = req.params;
  const { pickups, drops } = req.body;

  if (
    !Array.isArray(pickups) ||
    pickups.length === 0 ||
    !Array.isArray(drops) ||
    drops.length === 0
  ) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Pickup and drop fields are required as arrays"
    );
  }

  const existingRoute = await BusRouteModel.findById(routeId);
  if (!existingRoute) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus route not found");
  }

  // // Add unique pickups
  // pickups.forEach((pickup) => {
  //   if (!existingRoute.pickups.some((p) => p.name === pickup.name)) {
  existingRoute.pickups = pickups;
  //   }
  // });

  // Add unique drops
  // drops.forEach((drop) => {
  //   if (!existingRoute.drops.some((d) => d.name === drop.name)) {
  existingRoute.drops = drops;
  //   }
  // });

  await existingRoute.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        existingRoute,
        "Pickup and drop added successfully"
      )
    );
});

const getPickUpAndDrops = catchAsyncError(async (req, res, next) => {
  const { routeId } = req.params;

  const existingRoute = await BusRouteModel.findById(routeId);
  if (!existingRoute) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus route not found");
  }

  const data = {
    pickups: existingRoute.pickups,
    drops: existingRoute.drops,
  };

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        data,
        "Pickup and drop retrieved successfully"
      )
    );
});

const getRoutesOfBusOperator = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const startIndex = (page - 1) * limit;


  let { status, search, filter, date, from, to } = req.query;

  console.log("Query Params:", req.query);

  status = status || "active";

  const query = {
    createdBy: _id,
    status
  };

  if (from) {
    query.startLocation = { $regex: from, $options: "i" };
  }

  if (to) {
    query.endLocation = { $regex: to, $options: "i" };
  }

  if (date) {
    const day = moment(date, 'DD-MM-YYYY').format("dddd");
    query.runningDays = day;
  }



  const [routes, totalBus] = await Promise.all([
    BusRouteModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(startIndex)
      .populate({
        path: "busId",
        select: "assignedDriver bugRegNumber",
        populate: {
          path: "assignedDriver busName busModelNumber",
          select: "fullName phoneNumber",
        },
      })
      .populate("seats", "noOfSeats bookedSeats availableSeats"),
    BusRouteModel.countDocuments(query),
  ]);

  if (!routes.length) {
    return next(
      new ApiError(statusCode.NOT_FOUND, "No matching bus routes found")
    );
  }

  const newRoutes = await Promise.all(
    routes?.map(async (route) => {
      const pricePerSeat = await getFinalPrice(
        "bus",
        route.pricePerSeat,
        new Date()
      );
      return {
        ...route.toObject(),
        pricePerSeat,
      };
    })
  );

  const result = {
    routes: newRoutes,
    totalPages: Math.ceil(totalBus / limit),
    currentPage: page,
    totalCount: totalBus,
  };

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, result, "Routes found successfully"));
});

const updateRouteStatus = catchAsyncError(async (req, res, next) => {
  const { routeId } = req.params;

  const busRoutes = await BusRouteModel.findById(routeId).select("status");

  if (!busRoutes) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus route not found");
  }
  busRoutes.status = busRoutes.status === "active" ? "inactive" : "active";

  await busRoutes.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        busRoutes,
        "Bus routes status updated successfully"
      )
    );
});

const updateRoutePrice = catchAsyncError(async (req, res, next) => {
  const { routeId, pricePerSeat } = req.body;

  if (!routeId || pricePerSeat === undefined) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "routeId and pricePerSeat are required"
    );
  }

  const price = Number(pricePerSeat);
  if (!Number.isFinite(price) || price < 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "pricePerSeat must be a positive number"
    );
  }

  const busRoute = await BusRouteModel.findById(routeId);
  if (!busRoute) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus route not found");
  }

  busRoute.pricePerSeat = price;
  await busRoute.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        busRoute,
        "Bus route price updated successfully"
      )
    );
});

module.exports = {
  createBusRoute,
  updateBusRoute,
  deleteBusRoute,
  getAllBusRoutes,
  getSingleBusRoutes,
  addPickupDropToRoute,
  getPickUpAndDrops,
  getRoutesOfBusOperator,
  getSingleBusRoutesByBusId,
  updateRouteStatus,
  updateRoutePrice,
};

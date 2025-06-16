
const BusRouteModel = require("../../../models/bus-module/bus-routes/bus-routes.model");
const BusModel = require("../../../models/bus-module/buses/buses.model");
const statusCode = require("../../../utils/constants/statusCode");
const { validateRequestBody } = require("../../../utils/reqFunctions/reqFunction");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");


// =============|| GET ALL BUS ROUTES ||=============================
const getAllBusRoutes = catchAsyncError(async (req, res, next) => {
    const { busId } = req.params;

    const busRoutes = await BusRouteModel.find({ busId });

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


// =============|| UPDATE BUS ROUTE ||=============================

const updateBusRoute = catchAsyncError(async (req, res, next) => {
    const { id } = req.params;
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

    const reqFields = [
        "busId",
        "startLocation",
        "endLocation",
        "departureTime",
        "arrivalTime",
        "pricePerSeat",
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
        pricePerSeat,
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



module.exports = {
    getAllBusRoutes,
    getSingleBusRoutes,
    getSingleBusRoutesByBusId,
    updateBusRoute,
}
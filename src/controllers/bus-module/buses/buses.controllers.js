const {
  validateRequestBody,
  checkBusOperatorAuthority,
  getTodayNormalized,
  getDayOfDate,
} = require("../../../utils/reqFunctions/reqFunction");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const statusCode = require("../../../utils/constants/statusCode");
const {
  uploadMultipleImagesToAws,
  uploadSingleImageToAws,
} = require("../../../utils/uploadFiles/images/uploadImages");
const {
  busOperatorAuthoritiesFields,
} = require("../../../utils/constants/constants");
const BusModel = require("../../../models/bus-module/buses/buses.model");
const BusImagesModel = require("../../../models/bus-module/bus-images/bus-images.model");
const {
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");
const BusRouteModel = require("../../../models/bus-module/bus-routes/bus-routes.model");
const BusSeatsLayoutModel = require("../../../models/bus-module/bus-seats-management/buses-seats.model");
const { getFinalPrice } = require("../../../utils/services/prices.services");
const UserRecentSearchModel = require("../../../models/user-module/user-recent-search/user-recent-search.model");
const { fetchLn } = require("../../../utils/services/user.services");
const { translateLn } = require("../../../utils/services/translator.service");

// =================|| ADD BUS ||==================
const addBus = catchAsyncError(async (req, res, next) => {
  let userId = checkBusOperatorAuthority(
    req,
    busOperatorAuthoritiesFields.BUS_MANAGEMENT
  );
  let {
    busName,
    busRegNumber,
    busModelNumber,
    amenities,
    runningDays,
    noOfSeats,
  } = req.body;

  const { busImages, bus_license_front } = req.files;

  if (!busImages || busImages.length < 3) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please select at least 3 images"
    );
  }
  if (!bus_license_front) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please upload bus_license");
  }

  const reqField = ["busName", "busRegNumber", "busModelNumber", "runningDays"];
  validateRequestBody(reqField, req.body);

  const existingBus = await BusModel.findOne({ busRegNumber });
  if (existingBus) {
    throw new ApiError(
      statusCode.CONFLICT,
      "Bus with this registration number already exists"
    );
  }

  try {
    if (typeof amenities === "string") amenities = JSON.parse(amenities);
    if (typeof runningDays === "string") runningDays = JSON.parse(runningDays);
  } catch (error) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Invalid JSON format for amenities or runningDays"
    );
  }

  const [uploadImages, uploadBusLicense] = await Promise.all([
    uploadMultipleImagesToAws(busImages),
    uploadSingleImageToAws(bus_license_front),
  ]);
  const newBus = new BusModel({
    ownerId: userId,
    busName,
    busRegNumber,
    busModelNumber,
    amenities:
      Array.isArray(amenities) && amenities.length > 0 ? amenities : [],
    runningDays,
    busLicenseFront: uploadBusLicense || {},
    noOfSeats,
  });

  const busImg = new BusImagesModel({
    busId: newBus._id,
    images: uploadImages,
    uploadedBy: userId,
  });

  newBus.busImages = busImg._id;

  await Promise.all([newBus.save(), busImg.save()]);

  const data = {
    newBus,
    images: uploadImages,
  };

  return res
    .status(statusCode.CREATED)
    .json(new ApiResponse(statusCode.CREATED, data, "Bus added successfully"));
});

// =================|| UPDATE BUS DETAILS ||==================
const updateBus = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;

  let userId = checkBusOperatorAuthority(
    req,
    busOperatorAuthoritiesFields.BUS_MANAGEMENT
  );

  const { busId } = req.params;
  let { busName, busRegNumber, busModelNumber, amenities, runningDays } =
    req.body;
  const { busImages, bus_license_front } = req.files || {};

  if (!busId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Bus ID is required");
  }
  const existingBus = await BusModel.findOne({ _id: busId, ownerId: userId });
  if (!existingBus) {
    return next(
      new ApiError(statusCode.NOT_FOUND, "Bus not found or unauthorized")
    );
  }

  try {
    if (typeof amenities === "string") amenities = JSON.parse(amenities);
    if (typeof runningDays === "string") runningDays = JSON.parse(runningDays);
  } catch (error) {
    return next(
      new ApiError(
        statusCode.BAD_REQUEST,
        "Invalid JSON format for amenities or runningDays"
      )
    );
  }

  let uploadedBusImages = [];
  let uploadedBusLicense = existingBus?.busLicenseFront;

  if (busImages && busImages.length > 0) {
    uploadedBusImages = await uploadMultipleImagesToAws(busImages);
    const oldBusImages = await BusImagesModel.findOne({ busId });

    let allImages = uploadedBusImages;
    if (oldBusImages) {
      allImages = [...oldBusImages.images, ...uploadedBusImages];
    }

    await BusImagesModel.findOneAndUpdate(
      { busId },
      { images: allImages, uploadedBy: userId },
      { new: true, upsert: true }
    );
  }

  if (bus_license_front) {
    uploadedBusLicense = await uploadSingleImageToAws(bus_license_front);

    const imgToBeDeleted = existingBus.busLicenseFront;
    if (imgToBeDeleted) {
      await deleteImageFromAws(imgToBeDeleted.public_id);
    }
  }
  const updatedBus = await BusModel.findByIdAndUpdate(
    busId,
    {
      busName,
      busModelNumber,
      amenities,
      runningDays,
      busLicenseFront: uploadedBusLicense,
    },
    { new: true }
  );
  const busRoute = await BusRouteModel.findOne({ busId });
  if (busRoute) {
    busRoute.runningDays = updatedBus?.runningDays;
    await busRoute.save();
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, updatedBus, "Bus updated successfully")
    );
});

// =================|| GET ALL BUSED ||==================
const getAllBuses = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;

  let userId = checkBusOperatorAuthority(
    req,
    busOperatorAuthoritiesFields.BUS_MANAGEMENT
  );

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const startIndex = (page - 1) * limit;
  let { status, search } = req.query;

  status = status || "active";

  const query = { ownerId: userId, status };

  if (search && search.trim() !== "") {
    function escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    console.log("Search Term:", search);
    const regex = new RegExp(escapeRegex(search), "i");

    query.$or = [
      { busRegNumber: regex }, // ✅ registration number
      { busName: regex }, // ✅ bus name
      { busModelNumber: regex }, // ✅ model number
      { status: regex }, // ✅ status
    ];
  }

  const buses = await BusModel.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex)
    .populate("assignedDriver", "fullName")
    .populate("busImages", "images")
    .select(
      "assignedDriver busRegNumber busName busModelNumber status noOfSeats"
    );

  if (!buses || buses.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "No buses found");
  }

  let filteredBuses = buses;
  if (search && search.trim() !== "") {
    const regex = new RegExp(search, "i");
    filteredBuses = buses.filter(
      (bus) =>
        bus.assignedDriver?.fullName?.match(regex) ||
        bus.busRegNumber?.match(regex) ||
        bus.busName?.match(regex) ||
        bus.busModelNumber?.match(regex) ||
        bus.status?.match(regex)
    );
  }

  const busesWithFirstImage = filteredBuses.map((bus) => ({
    ...bus.toObject(),
    busImages: bus.busImages?.images?.[0] || null,
  }));

  const totalBus = await BusModel.countDocuments(query).exec();
  const results = {
    buses: busesWithFirstImage,
    totalPages: Math.ceil(totalBus / limit),
    currentPage: page,
    totalCount: totalBus,
    page,
    limit,
  };

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, results, "Data found successfully"));
});

// =================|| GET BUS BY ID ||==================
const getSingleBus = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const { busId } = req.params;
  let { status, search } = req.query;

  let userId = checkBusOperatorAuthority(
    req,
    busOperatorAuthoritiesFields.BUS_MANAGEMENT
  );

  status = status || "active";

  const bus = await BusModel.findOne({ _id: busId, ownerId: userId, status });

  if (!bus) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus not found");
  }

  const findBusImages = await BusImagesModel.findOne({ busId });
  const data = {
    bus,
    images: findBusImages?.images || [],
  };

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, data, "Data found successfully"));
});

// =================|| TOGGLE BUS STATUS ||==================
const changeBusStatus = catchAsyncError(async (req, res, next) => {
  const { busId } = req.params;

  const findBus = await BusModel.findById(busId);
  if (!findBus) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus not found");
  }

  findBus.status = findBus.status === "inactive" ? "active" : "inactive";
  await findBus.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        {},
        `Bus status changed to ${findBus.status}`
      )
    );
});

// =================|| SEARCHES BUS BY USERS||==================
const searchBuses = catchAsyncError(async (req, res, next) => {
  const { from, to, dateOfJourney } = req.query;
  const _id = req.user._id;
  const ln = await fetchLn(_id);

  console.log("serach: busFrom user-searchbooking");

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;

  const reqField = ["from", "to", "dateOfJourney"];
  validateRequestBody(reqField, req.query);

  const getDay = getDayOfDate(dateOfJourney);

  const query = {
    $and: [
      {
        $or: [
          { startLocation: { $regex: from, $options: "i" } },
          { "pickups.name": { $regex: from, $options: "i" } },
        ],
      },
      {
        $or: [
          { endLocation: { $regex: to, $options: "i" } },
          { "drops.name": { $regex: to, $options: "i" } },
        ],
      },
      {
        runningDays: {
          $in: [getDay],
        },
      },
      {
        status: "active",
      },
    ],
  };

  // Recent search handling (unchanged)
  let recentSearch = await UserRecentSearchModel.findOne({
    user: req.user?._id,
    category: "bus",
    "searchDetails.bus.from.address": from,
    "searchDetails.bus.to.address": to,
  });

  if (recentSearch) {
    recentSearch.searchDetails.bus.from = { address: from };
    recentSearch.searchDetails.bus.to = { address: to };
    recentSearch.searchTime = new Date();
  } else {
    recentSearch = new UserRecentSearchModel({
      user: req.user._id,
      category: "bus",
      searchDetails: {
        bus: {
          from: { address: from },
          to: { address: to },
        },
      },
    });
  }
  await recentSearch.save();

  const findRoutes = await BusRouteModel.find(query)
    .sort({ createdAt: -1 })
    .skip(startIndex)
    .limit(limit)
    .populate("seats", "bookedSeats availableSeats noOfSeats")
    .populate("busId", "busRegNumber busName busModelNumber rating noOfSeats")
    .lean();

  const BusSeatsLayoutModel = require("../../../models/bus-module/bus-seats-management/buses-seats.model");

  const startOfDay = new Date(dateOfJourney);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(dateOfJourney);
  endOfDay.setHours(23, 59, 59, 999);

  await Promise.all(
    findRoutes.map(async (route) => {
      const seatLayout = await BusSeatsLayoutModel.findOne({
        routeId: route._id,
        journeyDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      })
        .select("seats bookedSeats availableSeats noOfSeats")
        .lean();

      if (seatLayout) {
        route.seats = {
          bookedSeats: seatLayout.bookedSeats,
          availableSeats: seatLayout.availableSeats,
          noOfSeats: Number(seatLayout.noOfSeats || 0),
        };

        route.seatLayout = seatLayout.seats;
      } else {
        const totalSeats = Number(route.busId?.noOfSeats || 0);

        route.seats = {
          bookedSeats: 0,
          availableSeats: totalSeats,
          noOfSeats: totalSeats,
        };

        route.seatLayout = [];
      }
    })
  );

  // Add bus images
  await Promise.all(
    findRoutes.map(async (route) => {
      const busId = route?.busId?._id || route?.busId;
      if (!busId) return;

      const busImagesDoc = await BusImagesModel.findOne(
        { busId },
        { images: 1 }
      ).lean();
      const imageUrls = (busImagesDoc?.images || []).map((img) => img.url);

      if (typeof route.busId === "object") {
        route.busId.busImages = imageUrls;
      } else {
        route.busImages = imageUrls;
      }
    })
  );

  if (!findRoutes.length) {
    return next(
      new ApiError(statusCode.NOT_FOUND, translateLn(ln, "NO_BUS_ROUTES_FOUND"))
    );
  }

  const updatedRoutes = await Promise.all(
    findRoutes.map(async (route) => {
      // Calculate journey dates
      const startDate = new Date(dateOfJourney);
      const [depHour, depMin] = route.departureTime.split(":").map(Number);
      startDate.setHours(depHour, depMin, 0, 0);

      const [arrHour, arrMin] = route.arrivalTime.split(":").map(Number);
      let diffInMinutes = arrHour * 60 + arrMin - (depHour * 60 + depMin);
      if (diffInMinutes < 0) diffInMinutes += 24 * 60;

      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + diffInMinutes);

      // Get price
      const pricePerSeat = await getFinalPrice(
        "bus",
        route.pricePerSeat,
        new Date()
      );

      // Transform the route object
      const transformedRoute = {
        ...route,

        from: route.startLocation,
        to: route.endLocation,

        startLocation: undefined,
        endLocation: undefined,

        pricePerSeat: {
          finalAmount: pricePerSeat.toString(),
        },
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      // Clean up undefined fields
      delete transformedRoute.startLocation;
      delete transformedRoute.endLocation;

      return transformedRoute;
    })
  );

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        updatedRoutes,
        translateLn(ln, "BUS_ROUTES_FOUND")
      )
    );
});

const deletePermanentBus = catchAsyncError(async (req, res, next) => {
  const { busId } = req.params;

  // Find the bus
  const bus = await BusModel.findById(busId);
  if (!bus) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus not found");
  }

  // Find and delete all associated images
  const findBusImages = await BusImagesModel.findOne({ busId });
  if (findBusImages) {
    if (findBusImages?.images?.length > 0) {
      const imagesToDelete = findBusImages?.images;

      for (let file of imagesToDelete) {
        await deleteImageFromAws(file.public_id); // Delete from AWS
      }

      // Delete images from DB
      await BusImagesModel.deleteOne({ busId });
    }
  }

  if (bus) {
    if (bus?.busLicenseFront && bus?.busLicenseFront?.public_id) {
      await deleteImageFromAws(bus?.busLicenseFront?.public_id);
    }
    if (bus?.busLicense && bus?.busLicense?.public_id) {
      await deleteImageFromAws(bus?.busLicense?.public_id);
    }
  }

  // Delete all associated routes directly
  await BusRouteModel.deleteMany({ busId });
  await BusSeatsLayoutModel.deleteMany({ busId });

  // Delete the bus itself
  await BusModel.findByIdAndDelete(busId);

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, {}, "Bus deleted successfully"));
});

module.exports = {
  addBus,
  updateBus,
  getAllBuses,
  getSingleBus,
  changeBusStatus,
  searchBuses,
  deletePermanentBus,
};

const BusDriverModel = require("../../../models/bus-module/bus-drivers/bus-drivers.model");
const BusOperatorModel = require("../../../models/bus-module/bus-operator/bus-operator.model");
const BusModel = require("../../../models/bus-module/buses/buses.model");
const {
  busOperatorAuthoritiesFields,
} = require("../../../utils/constants/constants");
const statusCode = require("../../../utils/constants/statusCode");
const {
  validateRequestBody,
  checkBusOperatorAuthority,
} = require("../../../utils/reqFunctions/reqFunction");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  uploadSingleImageToAws,
} = require("../../../utils/uploadFiles/images/uploadImages");
const {
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");
const mongoose = require("mongoose");
const generateCustomId = require("../../../utils/customId/generateCustomId");
const { EntityCodeEnum } = require("../../../utils/constants/ENUM");

const { fetchLn } = require("../../../utils/services/user.services");
const { translateLn } = require("../../../utils/services/translator.service");

const registerBusDriver = catchAsyncError(async (req, res, next) => {
  const userId = checkBusOperatorAuthority(
    req,
    busOperatorAuthoritiesFields.DRIVER_MANAGEMENT
  );

  const { fullName, phoneNumber } = req.body;
  const docsToUpload = req.files;
  const requiredFields = ["fullName", "phoneNumber"];

  // ✅ Validate required fields
  validateRequestBody(requiredFields, req.body);

  // ✅ Validate required documents
  if (!docsToUpload?.driver_license_front || !docsToUpload?.avatar) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Driver license front and avatar are mandatory"
    );
  }
  const busOperator = await BusOperatorModel.findById(userId);
  if (!busOperator) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Bus Operator not found.");
  }
  const existingDriver = await BusDriverModel.findOne({ phoneNumber });
  if (existingDriver) {
    throw new ApiError(
      statusCode.CONFLICT,
      "Driver with this phone number already exists"
    );
  }
  const allowedDocs = ["driver_license_front", "avatar"];
  const uploadedKeys = Object.keys(docsToUpload);
  const invalidKeys = uploadedKeys.filter((key) => !allowedDocs.includes(key));
  if (invalidKeys.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid document types: ${invalidKeys.join(", ")}`
    );
  }
  const uploadImageFront = await uploadSingleImageToAws(
    docsToUpload.driver_license_front
  );
  const avatar = await uploadSingleImageToAws(docsToUpload.avatar);

  const busDriverId = await generateCustomId(EntityCodeEnum.BUSDRIVER, "BD");

  const newDriver = new BusDriverModel({
    busDriverId,
    fullName,
    phoneNumber,
    busOperator: busOperator._id,
    driverLicenseFront: uploadImageFront,
    avatar,
    assignedBus: null, // not assigned
    status: "unassigned", // new field in schema
  });

  const savedDriver = await newDriver.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        savedDriver,
        "Bus driver registered successfully without bus assignment"
      )
    );
});

const updateBusDriverDetails = catchAsyncError(async (req, res, next) => {
  console.log("hitting");
  const { fullName, busRegNumber, phoneNumber } = req.body;
  const docsToUpload = req.files || {};
  const { id } = req.params;

  const keys = Object.keys(docsToUpload || {});

  // Check if driver exists
  const existingDriver = await BusDriverModel.findById(id);
  if (!existingDriver) {
    throw new ApiError(statusCode.BAD_REQUEST, "Driver not found");
  }

  // ✅ Check if the phoneNumber already exists for another driver
  if (phoneNumber && phoneNumber !== existingDriver.phoneNumber) {
    const phoneExists = await BusDriverModel.findOne({ phoneNumber });
    if (phoneExists) {
      throw new ApiError(statusCode.CONFLICT, "Phone number already in use");
    }
  }

  const validDocumentTypes = [
    "driver_license_front",
    "driver_license_back",
    "avatar",
  ];
  const invalidKeys = keys?.filter((key) => !validDocumentTypes.includes(key));

  if (invalidKeys.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid document types: ${invalidKeys.join(", ")}`
    );
  }

  let avatar = existingDriver?.avatar;
  let uploadImageFront = existingDriver?.driverLicenseFront;

  if (docsToUpload?.["driver_license_front"]) {
    if (existingDriver?.driverLicense?.public_id) {
      await deleteImageFromAws(existingDriver.driverLicenseFront.public_id);
    }
    uploadImageFront = await uploadSingleImageToAws(
      docsToUpload["driver_license_front"]
    );
  }

  if (docsToUpload?.["avatar"]) {
    if (existingDriver?.avatar?.public_id) {
      await deleteImageFromAws(existingDriver.avatar.public_id);
    }
    avatar = await uploadSingleImageToAws(docsToUpload["avatar"]);
  }

  // Update Driver Details
  existingDriver.fullName = fullName || existingDriver.fullName;
  existingDriver.busRegNumber = busRegNumber || existingDriver.busRegNumber;
  existingDriver.phoneNumber = phoneNumber || existingDriver.phoneNumber;
  existingDriver.avatar = avatar;
  existingDriver.driverLicenseFront = uploadImageFront;

  await existingDriver.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        existingDriver,
        "Details updated successfully"
      )
    );
});

// =============================||ASSIGN DRIVER TO BUS|================================================
// const assignDriverToBus = catchAsyncError(async (req, res, next) => {
//   const { busRegNumber, driverPhoneNumber } = req.body;

//   const reqField = ["busRegNumber", "driverPhoneNumber"];
//   validateRequestBody(reqField, req.body);

//   // Find the bus
//   const findBus = await BusModel.findOne({
//     busRegNumber,
//     status: "active",
//   });

//   if (!findBus) {
//     throw new ApiError(statusCode.NOT_FOUND, "Bus not found");
//   }

//   // Find the driver
//   const findDriver = await BusDriverModel.findOne({
//     phoneNumber: driverPhoneNumber,
//   });

//   if (!findDriver) {
//     throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
//   }

//   // Check if the driver is already assigned to a bus
//   if (findDriver.assignedBus) {
//     // Remove the driver from the previous bus
//     await BusModel.findByIdAndUpdate(findDriver.assignedBus, {
//       assignedDriver: null,
//     });
//   }

//   // Assign the driver to the new bus
//   await findDriver.updateOne({ assignedBus: findBus._id });
//   await findBus.updateOne({ assignedDriver: findDriver._id });

//   return res
//     .status(statusCode.OK)
//     .json(new ApiResponse(statusCode.OK, "Driver assigned successfully"));
// });

const assignDriverToBus = catchAsyncError(async (req, res, next) => {
  const { busRegNumber, driverPhoneNumber } = req.body;
  const ln = (req.headers["ln"] || "en").toLowerCase();

  const reqField = ["busRegNumber", "driverPhoneNumber"];
  validateRequestBody(reqField, req.body);

  // Find Bus
  const findBus = await BusModel.findOne({
    busRegNumber,
    status: "active",
  }).populate("ownerId");

  if (!findBus) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus not found");
  }

  // Find Driver
  const findDriver = await BusDriverModel.findOne({
    phoneNumber: driverPhoneNumber,
  })
    .populate("busOperator")
    .populate({
      path: "assignedBus",
      populate: [{ path: "routes" }, { path: "busImages" }],
    });

  if (!findDriver) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  // Validate same operator
  if (
    !findBus.ownerId ||
    !findDriver.busOperator ||
    String(findBus.ownerId._id || findBus.ownerId) !==
      String(findDriver.busOperator._id || findDriver.busOperator)
  ) {
    return next(
      new ApiError(401, "Driver and Bus must belong to the same Bus Operator")
    );
  }

  // Safety check
  if (!Array.isArray(findBus.assignedDriver)) {
    findBus.assignedDriver = [];
  }

  // Check duplicate in same bus
  const alreadyAssigned = findBus.assignedDriver.some(
    (driverId) => String(driverId) === String(findDriver._id)
  );

  if (alreadyAssigned) {
    return next(
      new ApiError(400, "This driver is already assigned to this bus.")
    );
  }

  // HARD FIX: remove driver from ALL other buses
  await BusModel.updateMany(
    {
      _id: { $ne: findBus._id },
      assignedDriver: findDriver._id,
    },
    {
      $pull: { assignedDriver: findDriver._id },
    }
  );

  // Safety re-fetch current bus after cleanup
  const updatedBus = await BusModel.findById(findBus._id);

  if (!Array.isArray(updatedBus.assignedDriver)) {
    updatedBus.assignedDriver = [];
  }

  // Add driver to target bus
  updatedBus.assignedDriver.push(findDriver._id);
  await updatedBus.save();

  // Update driver
  findDriver.assignedBus = updatedBus._id;
  findDriver.status = "assigned";
  await findDriver.save();

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, "Driver assigned successfully"));
});

const getBusDrivers = catchAsyncError(async (req, res, next) => {
  let userId = checkBusOperatorAuthority(
    req,
    busOperatorAuthoritiesFields.DRIVER_MANAGEMENT
  );

  const { page: queryPage, limit: queryLimit, search, status } = req.query;
  const page = parseInt(queryPage) || 1;
  const limit = parseInt(queryLimit) || 10;
  const startIndex = (page - 1) * limit;

  // Base query
  const query = { busOperator: userId };
  if (status) query.status = status;

  // Search by driverId
  if (search) {
    query.$or = [
      { busDriverId: { $regex: search, $options: "i" } },
      { fullName: { $regex: search, $options: "i" } },
      { phoneNumber: { $regex: search, $options: "i" } },
    ];
  }

  // Fetch drivers
  const busDrivers = await BusDriverModel.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex)
    .populate("busOperator", "fullName")
    .populate("assignedBus", "busRegNumber")
    .select(
      "avatar driverLicenseFront status isActive busDriverId fullName busDriverId phoneNumber"
    );

  if (!busDrivers || busDrivers.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "No bus drivers found");
  }

  // Total count for pagination
  const totalBus = await BusDriverModel.countDocuments(query).exec();

  const results = {
    busDrivers,
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

const deleteDrivers = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  // Find driver belonging to the logged-in bus operator
  const driver = await BusDriverModel.findOne({
    busOperator: req.user._id,
    _id: id,
  });

  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Not Found or already deleted");
  }

  // Delete driver images from AWS if they exist
  if (driver.avatar && driver.avatar.public_id) {
    await deleteImageFromAws(driver.avatar.public_id);
  }
  if (driver?.driverLicenseFront && driver?.driverLicenseFront?.public_id) {
    await deleteImageFromAws(driver?.driverLicenseFront?.public_id);
  }
  if (driver?.driverLicense && driver.driverLicense?.public_id) {
    await deleteImageFromAws(driver?.driverLicense?.public_id);
  }

  // Check if the driver is assigned to any bus
  const bus = await BusModel.findOne({ assignedDriver: id });

  if (bus) {
    bus.assignedDriver = null;
    await bus.save();
  }
  await BusDriverModel.deleteOne({ busOperator: req.user._id, _id: id });

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, {}, "Driver deleted successfully."));
});

const getDriverById = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  // Validate that id is a valid MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid driver ID format");
  }

  const driver = await BusDriverModel.findById(id)
    .populate("assignedBus", "busRegNumber") // Optional: populate assigned bus
    .select(
      "fullName busDriverId phoneNumber assignedBus status isActive driverLicenseFront avatar createdAt updatedAt"
    );

  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        driver,
        "Bus driver profile fetched successfully"
      )
    );
});
// const unassignDriver = catchAsyncError(async (req, res, next) => {
//   console.log("Unassigning driver from bus...");
//   const { busId, driverId } = req.query;

//   const driver = await BusDriverModel.findOne({
//     _id: driverId,
//     busOperator: req.user._id,
//   });

//   if (!driver) {
//     throw new ApiError(statusCode.NOT_FOUND, "Driver not found or does not belong to you");
//   }

//   s
//   const bus = await BusModel.findOne({
//     _id: busId,
//     assignedDriver: driverId,
//   });

//   if (!bus) {
//     throw new ApiError(statusCode.NOT_FOUND, "Bus not found or driver is not assigned to this bus");
//   }

//   bus.assignedDriver.pull(driverId);
//   await bus.save();

//   if (driver.assignedBus && String(driver.assignedBus) === String(busId)) {
//     driver.assignedBus = null;
//     driver.status = "unassigned";
//     await driver.save();
//   }

//   return res.status(statusCode.OK).json(
//     new ApiResponse(statusCode.OK, {}, "Driver unassigned successfully from the specific bus.")
//   );
// });

const unassignDriver = catchAsyncError(async (req, res, next) => {
  console.log("🔹 Unassigning driver from bus... Amit");
  const { driverId } = req.query;

  console.log(`🔹 Received driverId: ${driverId}`);

  // ✅ Validate required parameter
  if (!driverId) {
    return next(
      new ApiError(statusCode.BAD_REQUEST, "driverId is required in query")
    );
  }

  // ✅ Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(driverId)) {
    return next(
      new ApiError(statusCode.BAD_REQUEST, "Invalid driver ID format")
    );
  }

  // ✅ Step 1: Find the driver and ensure it belongs to the logged-in operator
  const driver = await BusDriverModel.findOne({
    _id: driverId,
    busOperator: req.user._id,
  });

  if (!driver) {
    return next(
      new ApiError(
        statusCode.NOT_FOUND,
        "Driver not found or does not belong to this operator"
      )
    );
  }

  // ✅ Step 2: Ensure the driver is currently assigned to a bus
  if (!driver.assignedBus) {
    return next(
      new ApiError(
        statusCode.BAD_REQUEST,
        "This driver is not assigned to any bus"
      )
    );
  }

  const busId = driver.assignedBus;

  // ✅ Step 3: Find the bus and ensure it belongs to the same operator
  const bus = await BusModel.findOne({
    _id: busId,
    ownerId: req.user._id,
  });

  if (!bus) {
    return next(
      new ApiError(statusCode.NOT_FOUND, "Bus not found for this operator")
    );
  }

  // ✅ Step 4: Remove driver from bus.assignedDriver array
  bus.assignedDriver = (bus.assignedDriver || []).filter(
    (id) => String(id) !== String(driverId)
  );

  // Optional: if bus has no drivers left, mark inactive
  if (bus.assignedDriver.length === 0) {
    bus.status = "inactive";
  }

  await bus.save();

  // ✅ Step 5: Update driver model
  driver.assignedBus = null;
  driver.status = "unassigned";
  await driver.save();

  await BusModel.updateMany(
    { assignedDriver: driverId },
    { $pull: { assignedDriver: driverId } }
  );

  // ✅ Step 6: Optional – Update other related collections if needed
  // await TripModel.updateMany(
  //   { driver: driverId, bus: busId },
  //   { $set: { driver: null, driverStatus: "unassigned" } }
  // );

  console.log(
    `✅ Driver ${driver.fullName} successfully unassigned from bus ${bus.busName}`
  );

  // ✅ Step 7: Send Response
  return res.status(statusCode.OK).json(
    new ApiResponse(statusCode.OK, {
      message: "Driver unassigned successfully",
      driver: {
        _id: driver._id,
        fullName: driver.fullName,
        status: driver.status,
        assignedBus: driver.assignedBus,
      },
      bus: {
        _id: bus._id,
        busName: bus.busName,
        assignedDriver: bus.assignedDriver,
        status: bus.status,
      },
    })
  );
});

// const unassignDriver = catchAsyncError(async (req, res, next) => {
//   const { driverPhoneNumber, busRegNumber } = req.body;

//   if (!driverPhoneNumber || !busRegNumber) {
//     throw new ApiError(400, "Missing driverPhoneNumber or busRegNumber");
//   }

//   const driver = await BusDriverModel.findOne({
//     phoneNumber: driverPhoneNumber,
//     busOperator: req.user._id,
//   });

//   if (!driver) {
//     throw new ApiError(404, "Driver not found or does not belong to you");
//   }

//   const bus = await BusModel.findOne({ busRegNumber });
//   if (!bus) {
//     throw new ApiError(404, "Bus not found");
//   }

//   bus.assignedDriver = bus.assignedDriver.filter(
//     (d) => d.toString() !== driver._id.toString()
//   );
//   await bus.save();

//   if (driver.assignedBus?.toString() === bus._id.toString()) {
//     driver.assignedBus = null;
//     await driver.save();
//   }

//   res.status(200).json({
//     success: true,
//     message: "Driver unassigned successfully",
//   });
// });

module.exports = {
  registerBusDriver,
  assignDriverToBus,
  updateBusDriverDetails,
  getBusDrivers,
  deleteDrivers,
  getDriverById,
  unassignDriver,
};

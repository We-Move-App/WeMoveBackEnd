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

// REGISTER DRIVER BY BUS OPERATOR
const registerBusDriver = catchAsyncError(async (req, res, next) => {
  let userId = checkBusOperatorAuthority(
    req,
    busOperatorAuthoritiesFields.DRIVER_MANAGEMENT
  );
  console.log("User ID:", userId);

  const { fullName, busRegNumber, phoneNumber } = req.body;
  const docsToUpload = req.files;
  const reqField = ["fullName", "phoneNumber", "busRegNumber"];

  validateRequestBody(reqField, req.body);
  if (!docsToUpload || Object.keys(docsToUpload).length === 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Driver license and Avatar is mandatory"
    );
  }
  console.log('dddddddddddddddddddddddd', fullName, busRegNumber, phoneNumber);

  const keys = Object.keys(req.files);
  const busOperatorExisting = await BusOperatorModel.findById(userId);
  if (!busOperatorExisting) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Bus Operator not found.");
  }

  const existingDriver = await BusDriverModel.findOne({ phoneNumber });
  console.log("Existing Driver:", existingDriver);

  if (existingDriver) {
    throw new ApiError(
      statusCode.CONFLICT,
      "Driver with this phone number already exists"
    );
  }

  const findBus = await BusModel.findOne({
    busRegNumber,
    status: "active",
  });

  if (!findBus) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus not found");
  }

  if (findBus.assignedDriver) {
    console.log("🚫 Bus is already assigned to driver ID:", findBus.assignedDriver);
    throw new ApiError(
      statusCode.CONFLICT,
      "Driver is already assigned for this bus"
    );
  }

  const validDocumentTypes = [
    "driver_license_front",
    "driver_license_back",
    "avatar",
  ];
  const invalidKeys = keys.filter((key) => !validDocumentTypes.includes(key));
  if (invalidKeys.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid document types: ${invalidKeys.join(", ")}`
    );
  }

  const imgUpload = docsToUpload["driver_license_front"];
  const avatarUpload = docsToUpload["avatar"];
  const uploadImageFront = await uploadSingleImageToAws(imgUpload);
  const avatar = await uploadSingleImageToAws(avatarUpload);

  // 1️⃣ First save the driver
  const newDriver = new BusDriverModel({
    fullName,
    phoneNumber,
    busOperator: busOperatorExisting._id,
    assignedBus: findBus._id,
    driverLicenseFront: uploadImageFront,
    avatar,
  });
  console.log("🆕 Driver ID before save:", newDriver._id);

  const savedDriver = await newDriver.save();

  // 2️⃣ Then update the bus with driver's ID
  findBus.assignedDriver = savedDriver._id;
  await findBus.save();

  const updateResult = { ...savedDriver.toObject(), busRegNumber };

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      updateResult,
      "Bus driver registered successfully"
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
const assignDriverToBus = catchAsyncError(async (req, res, next) => {
  const { busRegNumber, driverPhoneNumber } = req.body;

  const reqField = ["busRegNumber", "driverPhoneNumber"];
  validateRequestBody(reqField, req.body);

  // Find the bus
  const findBus = await BusModel.findOne({
    busRegNumber,
    status: "active",
  });

  if (!findBus) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus not found");
  }

  // Find the driver
  const findDriver = await BusDriverModel.findOne({
    phoneNumber: driverPhoneNumber,
  });

  if (!findDriver) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  // Check if the driver is already assigned to a bus
  if (findDriver.assignedBus) {
    // Remove the driver from the previous bus
    await BusModel.findByIdAndUpdate(findDriver.assignedBus, {
      assignedDriver: null,
    });
  }

  // Assign the driver to the new bus
  await findDriver.updateOne({ assignedBus: findBus._id });
  await findBus.updateOne({ assignedDriver: findDriver._id });

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, "Driver assigned successfully"));
});

const getBusDrivers = catchAsyncError(async (req, res, next) => {
  let userId = checkBusOperatorAuthority(
    req,
    busOperatorAuthoritiesFields.DRIVER_MANAGEMENT
  );
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const startIndex = (page - 1) * limit;

  const busDrivers = await BusDriverModel.find({ busOperator: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex)
    .populate("busOperator", "fullName")
    .populate("assignedBus", "busRegNumber")
    .select("avatar driverLicenseFront fullName phoneNumber");

  if (!busDrivers || busDrivers.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "No bus drivers found");
  }

  const totalBus = await BusDriverModel.countDocuments({ busOperator: userId }).exec();
  const results = {
    busDrivers: busDrivers,
    totalPages: Math.ceil(totalBus / limit),
    currentPage: page,
    totalCount: totalBus,
  };

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, results, "Data found successfully")
    );
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
  const driver = await BusDriverModel.findById("6864ccf2da54b6f881473de4");
  console.log("Driver found:", driver);


  // const driver = await BusDriverModel.findById(id)
  //   .populate("busOperator", "fullName")
  //   .populate("assignedBus", "busRegNumber")
  //   .select("driverLicenseFront fullName phoneNumber avatar");

  // if (!driver) {
  //   throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  // }

  // return res
  //   .status(statusCode.OK)
  //   .json(new ApiResponse(statusCode.OK, driver, "Data found successfully"));
});

module.exports = {
  registerBusDriver,
  assignDriverToBus,
  updateBusDriverDetails,
  getBusDrivers,
  deleteDrivers,
  getDriverById,
};

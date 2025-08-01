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
  const uploadImageFront = await uploadSingleImageToAws(docsToUpload.driver_license_front);
  const avatar = await uploadSingleImageToAws(docsToUpload.avatar);


  const newDriver = new BusDriverModel({
    fullName,
    phoneNumber,
    busOperator: busOperator._id,
    driverLicenseFront: uploadImageFront,
    avatar,
    assignedBus: null,            // not assigned
    status: "unassigned",         // new field in schema
  });

  const savedDriver = await newDriver.save();

  return res.status(statusCode.OK).json(
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

  const reqField = ["busRegNumber", "driverPhoneNumber"];
  validateRequestBody(reqField, req.body);

  const findBus = await BusModel.findOne({ busRegNumber, status: "active" }).populate("ownerId");

  if (!findBus) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus not found");
  }


  const findDriver = await BusDriverModel.findOne({ phoneNumber: driverPhoneNumber })
    .populate("busOperator")
    .populate({
      path: "assignedBus",
      populate: [
        { path: "routes" },
        { path: "busImages" },
      ],
    });

  if (!findDriver) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  // Step 3: Ensure the driver and bus belong to the same operator
  if (
    !findBus.ownerId ||
    !findDriver.busOperator ||
    String(findBus.ownerId._id || findBus.ownerId) !== String(findDriver.busOperator._id || findDriver.busOperator)
  ) {
    return next(new ApiError(401, "Driver and Bus must belong to the same Bus Operator"));
  }


  // if (findDriver.assignedBus) {
    // await BusModel.findByIdAndUpdate(findDriver.assignedBus, {
    //   assignedDriver: null,
    // });
if (!Array.isArray(findBus.assignedDriver)) {
  findBus.assignedDriver = [];
}
const alreadyAssigned = findBus.assignedDriver.some(
  (driverId) => String(driverId) === String(findDriver._id)
);

if (alreadyAssigned) {
  return next(new ApiError(400, "This driver is already assigned to this bus."));
}
    
    findBus.assignedDriver.push(findDriver._id) 
    await findBus.save()



    findDriver.assignedBus = findBus._id;
    findDriver.status = "assigned"; 
    await findDriver.save()
  // }

  // Step 5: Assign the driver to the new bus and update status
  // await BusDriverModel.findByIdAndUpdate(findDriver._id, {
  //   assignedBus: findBus._id,
  //   status: "assigned"
  // });

  // await BusModel.findByIdAndUpdate(findBus._id, {
  //   assignedDriver: findDriver._id,
  // });
const updatedDriver = await BusDriverModel.findById(findDriver._id);
console.log("Status in DB after save:", updatedDriver.status); 

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
    .select("avatar driverLicenseFront  status  isActive fullName phoneNumber");

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
  console.log("id:",id)
  // Validate that id is a valid MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid driver ID format");
  }

  const driver = await BusDriverModel.findById(id)
    .populate("assignedBus", "busRegNumber") // Optional: populate assigned bus
    .select("fullName phoneNumber assignedBus status isActive driverLicenseFront avatar createdAt updatedAt");

  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, driver, "Bus driver profile fetched successfully"));
});
const unassignDriver = catchAsyncError(async (req, res, next) => {
  console.log("Unassigning driver from bus...");
  const { busId, driverId } = req.query ;

  const driver = await BusDriverModel.findOne({
    _id: driverId,
    busOperator: req.user._id,
  });

  if (!driver) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found or does not belong to you");
  }

 s
  const bus = await BusModel.findOne({
    _id: busId,
    assignedDriver: driverId,
  });

  if (!bus) {
    throw new ApiError(statusCode.NOT_FOUND, "Bus not found or driver is not assigned to this bus");
  }

 
  bus.assignedDriver.pull(driverId);
  await bus.save();

  
  if (driver.assignedBus && String(driver.assignedBus) === String(busId)) {
    driver.assignedBus = null;
    driver.status = "unassigned";
    await driver.save();
  }

  return res.status(statusCode.OK).json(
    new ApiResponse(statusCode.OK, {}, "Driver unassigned successfully from the specific bus.")
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
  unassignDriver
};

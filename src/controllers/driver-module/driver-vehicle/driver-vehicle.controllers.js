const {
  DriverDocumentsModel,
} = require("../../../models/driver-module/driver-documents/driver-documents.model");
const DriverVehicleModel = require("../../../models/driver-module/driver-vehicle/driver-vehicle.model");
const DriverModel = require("../../../models/driver-module/drivers/drivers.model");
const {
  DocumentsModel,
} = require("../../../models/global-module/documents/document.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  uploadImageOnAws,
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");

const addVehicle = catchAsyncError(async (req, res, next) => {
  const { vehicle, vehicleType, model, regNumber, color, capacity, fuelType } =
    req.body;
  const { _id } = req.user;

  const docsToUpload = req.files;

  if (!docsToUpload || Object.keys(docsToUpload).length === 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "Files are mandatory");
  }
  if (!vehicle || !vehicleType || !model || !regNumber) {
    throw new ApiError(statusCode.BAD_REQUEST, `Please enter required info`);
  }

  const keys = Object.keys(req.files);
  const validDocumentTypes = [
    "vehicle_registration_certificate",
    "vehicle_insurance",
    "vehicle_photo",
  ];
  const invalidKeys = keys.filter((key) => !validDocumentTypes.includes(key));

  if (invalidKeys.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid document types: ${invalidKeys.join(", ")}`
    );
  }
  const findUser = await DriverModel.findById(_id);
  if (!findUser) {
    throw new ApiError(statusCode.NOT_FOUND, `Please add driver details first`);
  }

  const isVehicleExist = await DriverVehicleModel.findOne({
    ownerId: _id,
    registrationNumber: regNumber,
  });
  if (isVehicleExist) {
    throw new ApiError(statusCode.NOT_FOUND, `Vehicle already exists`);
  }

  const userDocument = await DriverDocumentsModel.findOne({ userId: _id });

  let docsIds = [];
  for (const key of keys) {
    const imgFile = docsToUpload[key][0];
    const cloudImage = await uploadImageOnAws(
      imgFile.path,
      imgFile.originalname
    );

    const uploadedDoc = await DocumentsModel.create({
      documentName: key,
      documentType: key,
      file: {
        public_id: cloudImage?.public_id,
        url: cloudImage?.secure_url,
      },
      fileType: imgFile.mimetype,
      ownerId: req.user._id,
    });

    docsIds.push(uploadedDoc._id);
  }

  const newVehicle = new DriverVehicleModel({
    ownerId: _id,
    vehicleType,
    vehicle,
    model,
    registrationNumber: regNumber,
    color,
    capacity,
    fuelType,
  });

  if (!newVehicle) {
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      `Failed to create vehicle`
    );
  }
  if (!userDocument) {
    await DriverDocumentsModel.create({
      userId: _id,
      documentIds: docsIds,
    });
  } else {
    userDocument.documentIds.push(...docsIds);
    await userDocument.save();
  }
  findUser.vehicle = vehicle;

  await newVehicle.save();
  await findUser.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, newVehicle, `Vehicle added successfully`)
    );
});

const getVehicle = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;

  const [driverVehicle, driverDocs] = await Promise.all([
    DriverVehicleModel.findOne({
      ownerId: _id,
    }),
    DriverDocumentsModel.findOne({ userId: _id }).populate("documentIds"),
  ]);

  if (!driverVehicle) {
    throw new ApiError(statusCode.NOT_FOUND, `Vehicle not found`);
  }

  const validDocs = [
    "vehicle_insurance",
    "vehicle_registration_certificate",
    "vehicle_photo",
  ];

  const documents = driverDocs?.documentIds?.filter((doc) =>
    validDocs.includes(doc.documentName.toLowerCase())
  );

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        vehicle: driverVehicle,
        docs: documents,
      },
      `Vehicle details fetch successfully`
    )
  );
});

const updateVehicle = catchAsyncError(async (req, res, next) => {
  const { vehicle, vehicleType, model, regNumber, color, capacity, fuelType } =
    req.body;
  const { id } = req.params;
  const { _id } = req.user;

  if (!id) {
    throw new ApiError(statusCode.BAD_REQUEST, `Please provide vehicle id`);
  }

  const isVehicleExist = await DriverVehicleModel.findOne({
    ownerId: _id,
    _id: id,
  });
  if (!isVehicleExist) {
    throw new ApiError(statusCode.NOT_FOUND, `Vehicle not Found`);
  }

  const newDetails = {
    vehicle,
    vehicleType,
    model,
    registrationNumber: regNumber,
    color,
    capacity,
    fuelType,
  };

  const updateVehicle = await DriverVehicleModel.findOneAndUpdate(
    { _id: id },
    newDetails,
    {
      new: true,
    }
  );
  if (!updateVehicle) {
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      `Failed to update vehicle`
    );
  }
  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        updateVehicle,
        `Vehicle added successfully`
      )
    );
});

const deleteVehicle = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const { _id } = req.user;

  if (!id) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please provide vehicle ID");
  }

  const reqDocs = [
    "vehicle_registration_certificate",
    "vehicle_insurance",
    "vehicle_photo",
  ];

  // Delete vehicle entry
  const deletedVehicle = await DriverVehicleModel.findOneAndDelete({
    ownerId: _id,
    _id: id,
  });

  if (!deletedVehicle) {
    throw new ApiError(statusCode.NOT_FOUND, "Vehicle not found");
  }

  // Find related vehicle documents
  const vehicleDocuments = await DocumentsModel.find({
    ownerId: _id,
    documentType: { $in: reqDocs },
  });

  // Delete associated documents & images
  for (const doc of vehicleDocuments) {
    if (doc.file?.public_id) {
      await deleteImageFromAws(doc.file.public_id);
    }
  }

  // Delete documents from the database
  await DriverDocumentsModel.deleteMany({
    ownerId: _id,
    documentType: { $in: reqDocs },
  });

  // Remove document IDs from the user document list (if applicable)
  await DriverDocumentsModel.findOneAndUpdate(
    { _id },
    { $pull: { documentIds: { $in: vehicleDocuments.map((d) => d._id) } } },
    { new: true }
  );

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        deletedVehicle._id,
        "Vehicle deleted successfully"
      )
    );
});

module.exports = { addVehicle, getVehicle, updateVehicle, deleteVehicle };

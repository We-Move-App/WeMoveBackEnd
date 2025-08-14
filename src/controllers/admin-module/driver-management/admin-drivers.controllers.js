
const {
  getAllUsersByAdmin,
  userVerifiedByAdmin,
  getUserByIdByAdmin,
} = require("../../../utils/services/admin.services");

const DriverBankDetail = require("../../../models/new-driver-module/bank-details/bank-details.model");
const DriverDocDetails = require("../../../models/new-driver-module/documents/driver-documents.model");
const DriverBasicDetails = require("../../../models/new-driver-module/basic-details/basic-details.model");
const VehicleDetail = require("../../../models/new-driver-module/vehicle-details/vehicle-details.model")
const {getVehicleDetailsWithDocs } = require("../../new-driver-module/aggregations/vehicle-details.aggregations")
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  addBankDetailsValidation,
} = require("../../new-driver-module/validations/bank-details.validation");
const {
  DriverDocEnum,
  DriverDocStatusEnum,
} = require("../../../utils/constants/ENUM");
const ApiError = require("../../../utils/response/ApiError");

const statusCode = require("../../../utils/constants/statusCode");
const {
  decodeAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const { VehicleTypeEnum } = require("../../../utils/constants/ENUM");
const DriverLocation = require("../../../models/new-driver-module/location/driver-location.model")




const getAllDrivers = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filters
    const { status, mobile, registrationNo } = req.query;

    // Build driver filter
    const driverFilter = {};
    if (status) driverFilter.status = status;
    if (mobile) driverFilter.phoneNo = { $regex: mobile, $options: "i" };

    // Aggregation pipeline
    const drivers = await DriverBasicDetails.aggregate([
      { $match: driverFilter },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "vehicledetails", // MongoDB collection name
          localField: "driverId",
          foreignField: "driverId",
          as: "vehicleInfo",
        },
      },
      { $unwind: { path: "$vehicleInfo", preserveNullAndEmptyArrays: false } }, // only drivers with vehicles
      { $match: { "vehicleInfo.vehicleType": "bike" } }, // only bike
      {
        $project: {
          _id: 0,
          name: "$fullName",
          mobile: "$phoneNo",
          email: 1,
          status: 1,
          vehicleType: "$vehicleInfo.vehicleType",
          registrationNumber: "$vehicleInfo.registrationNo",
        },
      },
    ]);

    // Total count for pagination (filtered by vehicleType)
    const totalCount = await DriverBasicDetails.aggregate([
      { $match: driverFilter },
      {
        $lookup: {
          from: "vehicledetails",
          localField: "driverId",
          foreignField: "driverId",
          as: "vehicleInfo",
        },
      },
      { $unwind: { path: "$vehicleInfo", preserveNullAndEmptyArrays: false } },
      { $match: { "vehicleInfo.vehicleType": "bike" } },
      { $count: "total" },
    ]);

    const total = totalCount[0]?.total || 0;

    res.status(200).json({
      success: true,
      message: "Drivers fetched successfully",
      page,
      limit,
      total,
      data: drivers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error fetching drivers",
      error: error.message,
    });
  }
};
const getdriverDetailsById = catchAsyncError(async (req, res) => {
  const { driverId } = req.params;

  if (!driverId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Driver ID is required");
  }

  // Fetch basic driver info
  const basicDetails = await DriverBasicDetails.findOne({ driverId }).lean();
  if (!basicDetails) {
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  }

 
  const bankDetails = await DriverBankDetail.findOne({ driverId }).lean();
  const vehicleDetails = await VehicleDetail.findOne({ driverId }).lean();
  const docDetails = await DriverDocDetails.findOne({ driverId }).lean();
  const driverLocation = await DriverLocation.findOne({ driverId }).lean();
  const isOnline = driverLocation?.status === "online";

  const allDocs = docDetails?.documents || [];
  const findDoc = (type) => {
    const doc = allDocs.find((d) => d.documentType === type);
    return doc
      ? {
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          status: doc.status,
        }
      : null;
  };
  const response = {
    success: true,
    message: "Driver details fetched successfully",
    data: {
      driverBasicDetails: {
        name: basicDetails.fullName,
        age: basicDetails.age,
        mobile: basicDetails.phoneNo,
        email: basicDetails.email,
        address: basicDetails.address,
        status: basicDetails.status,
        experience: basicDetails.experience || 0,
       
      },
      documents: {
        idCard: findDoc(DriverDocEnum.IDCARD),
        license: findDoc(DriverDocEnum.LICENSE),
        passbook: findDoc(DriverDocEnum.PASSBOOK),
      },
      vehicleDetails: vehicleDetails
        ? {
            vehicleType: vehicleDetails.vehicleType,
            registrationNumber: vehicleDetails.registrationNo,
            insurance: findDoc(DriverDocEnum.INSURANCE),
            registrationCertificate: findDoc(DriverDocEnum.REGISTRATION),
            vehiclePhotos: findDoc(DriverDocEnum.VEHICLEPHOTO),
            avatarPhotos: findDoc(DriverDocEnum.AVATAR)
          }
        : null,
      bankDetails: bankDetails
        ? {
            accountNumber: bankDetails.accountNumber,
            holderName: bankDetails.holderName,
            passbook: findDoc(DriverDocEnum.PASSBOOK),
          }
        : null,
      isOnline,
    },
  };

  return res.status(statusCode.OK).json(response);
});

  

const verifyUserProfile = catchAsyncError(async (req, res, next) => {
  const result = await userVerifiedByAdmin({ req, model: DriverModel });

  return res.status(statusCode.OK).json(result);
});

module.exports = {
  getAllDrivers,
  getdriverDetailsById,
  verifyUserProfile,
};

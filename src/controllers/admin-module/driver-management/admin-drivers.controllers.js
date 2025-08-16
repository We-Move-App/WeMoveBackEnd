
const {
  getAllUsersByAdmin,
  userVerifiedByAdmin,
  getUserByIdByAdmin,
} = require("../../../utils/services/admin.services");
const AdminModel = require("../../../models/admin-module/admin/admin.model")
const DriverBankDetail = require("../../../models/new-driver-module/bank-details/bank-details.model");
const DriverDocDetails = require("../../../models/new-driver-module/documents/driver-documents.model");
const DriverBasicDetails = require("../../../models/new-driver-module/basic-details/basic-details.model");
const VehicleDetail = require("../../../models/new-driver-module/vehicle-details/vehicle-details.model")
const { getVehicleDetailsWithDocs } = require("../../new-driver-module/aggregations/vehicle-details.aggregations")
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  addBankDetailsValidation,
} = require("../../new-driver-module/validations/bank-details.validation");
const {
  DriverDocEnum,
  DriverDocStatusEnum,
} = require("../../../utils/constants/ENUM");
const RideBookingDetail = require("../../../models/new-driver-module/booking-details/booking-details.model");

const { addVehicleDetailsValidation } = require("../../new-driver-module/validations/vehicle-details.validations")
const statusCode = require("../../../utils/constants/statusCode");
const {
  decodeAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse")
const { VehicleTypeEnum } = require("../../../utils/constants/ENUM");
const DriverLocation = require("../../../models/new-driver-module/location/driver-location.model");
const { addBasicDetailsValidation } = require("../../new-driver-module/validations/basic-details.validation");
const generateCustomId = require("../../../utils/customId/generateCustomId")
const { DriverBasicStatus } = require("../../../utils/constants/ENUM")
const { generateTokens } = require("../../../utils/jwtToken/generateTokens")
const UserModel = require("../../../models/user-module/users/user.model");
const WalletModel = require("../../../models/wallet-module/wallets.model");
const TransactionModel = require("../../../models/transaction-module/transaction.model");

const getAllDrivers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { status, mobile, registrationNo, vehicleType } = req.query;
    if (!vehicleType) {
      return res.status(400).json({
        success: false,
        message: "vehicleType query parameter is required",
      });
    }

    if (!["bike", "taxi"].includes(vehicleType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicleType. Allowed values: bike, taxi",
      });
    }
    const driverFilter = {};
    if (status) driverFilter.status = status;
    if (mobile) driverFilter.phoneNo = { $regex: mobile, $options: "i" };


    const vehicleMatch = {};
    if (vehicleType) vehicleMatch["vehicleInfo.vehicleType"] = vehicleType;
    if (registrationNo)
      vehicleMatch["vehicleInfo.registrationNo"] = { $regex: registrationNo, $options: "i" };

    const drivers = await DriverBasicDetails.aggregate([
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
      { $match: vehicleMatch },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          driverId: 1,
          status: 1,
          email: 1,
          name: "$fullName",
          mobile: "$phoneNo",
          vehicleType: "$vehicleInfo.vehicleType",
          registrationNumber: "$vehicleInfo.registrationNo",
        },
      },
    ]);

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
      { $match: vehicleMatch },
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
   const { vehicleType } = req.query
  

   if (!driverId ||!vehicleType) {
    throw new ApiError(statusCode.BAD_REQUEST, "Driver ID  and vehileType is required");
  }
   if (vehicleType?.toLowerCase() !== "bike") {
    throw new ApiError(statusCode.BAD_REQUEST, "vehicleType must be 'bike'");
  
  }
  // Fetch driver with populated admin references
  const basicDetails = await DriverBasicDetails.findOne({ driverId })
    .populate("createdById", "name email role")
    .populate("updatedAtById", "name email role")
    .lean();

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
          documentType: doc.documentType,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          status: doc.status,
        }
      : null;
  };

  const response = {
    success: true,
    message: "Bike driver details fetched successfully",
    statusCode: statusCode.OK,
    data: {
      BikeDriverDetails: {
        driverId: basicDetails.driverId,
        name: basicDetails.fullName,
        age: basicDetails.age,
        mobile: basicDetails.phoneNo,
        email: basicDetails.email,
        address: basicDetails.address,
        status: basicDetails.status,
        experience: basicDetails.experience || 0,
        createdById: basicDetails.createdById, // populated { _id, email, role }
        updatedById: basicDetails.updatedAtById,
      },
      documents: {
        idCard: findDoc(DriverDocEnum.IDCARD),
        license: findDoc(DriverDocEnum.LICENSE),
        passbook: findDoc(DriverDocEnum.PASSBOOK),
        insurance: findDoc(DriverDocEnum.INSURANCE),
        registrationCertificate: findDoc(DriverDocEnum.REGISTRATION),
        vehicleBikePhotos: findDoc(DriverDocEnum.VEHICLEPHOTO),
        avatarPhotos: findDoc(DriverDocEnum.AVATAR),
      },
      bikeDetails: vehicleDetails
        ? {
            seats: vehicleDetails.seats || 2, // default if not stored
            model: vehicleDetails.model,
            registrationNo: vehicleDetails.registrationNo,
            vehicleType: vehicleDetails.vehicleType,
          }
        : null,
      bankDetails: bankDetails
        ? {
            accountNumber: bankDetails.accountNumber,
            holderName: bankDetails.holderName,
            document: findDoc(DriverDocEnum.PASSBOOK),
          }
        : null,
      isOnline,
      
    },
  };

  return res.status(statusCode.OK).json(response);
});
const verifyUserProfile = catchAsyncError(async (req, res) => {
  const { driverId } = req.params;
  const { status } = req.body;

  if (!driverId || !status) {
    throw new ApiError(statusCode.BAD_REQUEST, "Driver ID and status are required");
  }

  // 1️⃣ Update DriverBasicDetails
  await DriverBasicDetails.findOneAndUpdate(
    { driverId },
    { $set: { status } },
    { new: true }
  );

  // 2️⃣ Update all documents in DriverDocDetails
  await DriverDocDetails.updateMany(
    { driverId },
    { $set: { "documents.$[].status": status } } // Updates all docs in array
  );


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
    message: "All statuses updated successfully",
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
          avatarPhotos: findDoc(DriverDocEnum.AVATAR),
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
// const createDriverFromAdmin = catchAsyncError(async (req, res) => {
//   const { basicDriverDetails, bankDetails, vehicleDetails, documents = [] } = req.body;


//   const authHeader = req.headers.authorization;
//   if (!authHeader?.startsWith("Bearer "))
//     throw new ApiError(statusCode.UNAUTHORIZED, "Access token is missing or invalid");

//   const accessToken = authHeader.split(" ")[1];
//   const decoded = decodeAccessToken(accessToken);
//   const adminId = decoded?._id;
//   if (!adminId) throw new ApiError(statusCode.UNAUTHORIZED, "Invalid admin token");


//   const existingDriver = await DriverBasicDetails.findOne({
//     $or: [{ phoneNo: basicDriverDetails.phoneNo }, { email: basicDriverDetails.email }],
//   });

//   if (existingDriver) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Phone number or email already exists");
//   }


//   const existingVehicle = await VehicleDetail.findOne({
//     registrationNo: vehicleDetails.registrationNo,
//   });
//   if (existingVehicle) {
//     throw new ApiError(statusCode.BAD_REQUEST, "Vehicle registration number already exists");
//   }


//   const driverId = await generateCustomId("driver", "D");

//   // 5️⃣ Save driver basic details (auto-approved)
//   const savedDriver = await DriverBasicDetails.create({
//     ...basicDriverDetails,
//     driverId,
//     createdBy: "admin",
//     createdById: adminId,
//     status: DriverBasicStatus.APPROVED,
//     emailVerified: true,
//     isActive: true,
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   });

//   // 6️⃣ Save bank details (auto-approved)
//   await DriverBankDetail.updateOne(
//     { driverId },
//     { $set: { ...bankDetails, updatedAt: new Date() } },
//     { upsert: true }
//   );

//   // 7️⃣ Save vehicle details (auto-approved)
//   await VehicleDetail.updateOne(
//     { driverId },
//     { $set: { ...vehicleDetails, updatedAt: new Date() } },
//     { upsert: true }
//   );

//   // 8️⃣ Merge all documents and auto-approve
//   const allDocuments = {};

//   // Personal documents (id_card, license)
//   documents.forEach((doc) => {
//     if (doc.documentType === "id_card") allDocuments.idCard = { ...doc, status: "approved" };
//     if (doc.documentType === "license") allDocuments.license = { ...doc, status: "approved" };
//   });

//   // Bank passbook
//   if (bankDetails.document) {
//     allDocuments.passbook = { ...bankDetails.document, status: "approved" };
//   }

//   // Vehicle documents
//   ["insurance", "registrationCertificate", "vehiclePhotos", "avatarPhotos"].forEach((key) => {
//     if (vehicleDetails[key]) vehicleDetails[key].status = "approved";
//   });

//   // Save documents in DB
//   await DriverDocDetails.create({
//     driverId,
//     documents: [
//       ...(documents || []),
//       bankDetails.document,
//       vehicleDetails.insurance,
//       vehicleDetails.registrationCertificate,
//       vehicleDetails.vehiclePhotos,
//       vehicleDetails.avatarPhotos,
//     ].filter(Boolean),
//   });

//   // 9️⃣ Generate driver token
//   const driverToken =  await  generateTokens({ driverId });


//   // 🔟 Response in required format
//   return res.status(statusCode.CREATED).json(
//     new ApiResponse(
//       statusCode.CREATED,
//       {
//         driverBasicDetails: {
//           driverId:savedDriver.driverId,
//           name: savedDriver.fullName,
//           age: savedDriver.age,
//           mobile: savedDriver.phoneNo,
//           email: savedDriver.email,
//           address: savedDriver.address,
//           status: savedDriver.status,
//           experience: savedDriver.experience,
//         },
//         documents: allDocuments,
//         vehicleDetails: vehicleDetails,
//         bankDetails: bankDetails,
//         isOnline: false,
//         token: driverToken
//       },

//       "Driver fully onboarded successfully by admin",


//     )
//   );
// });

const createBikeDriverFromAdmin = catchAsyncError(async (req, res) => {
  const {
    basicDriverDetails = {},
    bankDetails = {},
    vehicleDetails = {},
    documents = []
  } = req.body;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Access token is missing or invalid");
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const adminId = decoded?._id;

  if (!adminId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid admin token");
  }

  // Ensure only admins can create approved drivers
  if (decoded.role?.toLowerCase() !== "admin") {
    throw new ApiError(statusCode.FORBIDDEN, "Only admins can create approved drivers");
  }

  // Auto-set admin creation details
  basicDriverDetails.status = DriverBasicStatus.APPROVED;
  basicDriverDetails.createdBy = "admin";
  basicDriverDetails.createdById = adminId;

  // Check existing driver
  const existingDriver = await DriverBasicDetails.findOne({
    $or: [
      { phoneNo: basicDriverDetails.phoneNo },
      { email: basicDriverDetails.email }
    ]
  });
  if (existingDriver) {
    throw new ApiError(statusCode.BAD_REQUEST, "Phone number or email already exists");
  }

  const existingVehicle = await VehicleDetail.findOne({
    registrationNo: vehicleDetails.registrationNo
  });
  if (existingVehicle) {
    throw new ApiError(statusCode.BAD_REQUEST, "Vehicle registration number already exists");
  }

  const driverId = await generateCustomId("driver", "D");

  const savedDriver = await DriverBasicDetails.create({
    ...basicDriverDetails,
    driverId,
    emailVerified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Normalize documents
  const normalizeDoc = (doc, documentType) => {
    if (!doc) return null;
    return {
      documentType,
      fileUrl: doc.fileUrl || doc.url,
      fileName: doc.fileName,
      status: DriverDocStatusEnum.APPROVED
    };
  };

  const normalizedDocs = [
    ...documents.map(doc => normalizeDoc(doc, doc.documentType)),
    normalizeDoc(bankDetails.document, DriverDocEnum.PASSBOOK),
    normalizeDoc(vehicleDetails.insurance, DriverDocEnum.INSURANCE),
    normalizeDoc(vehicleDetails.registrationCertificate, DriverDocEnum.REGISTRATION),
    normalizeDoc(vehicleDetails.vehiclePhotos, DriverDocEnum.VEHICLEPHOTO),
    normalizeDoc(vehicleDetails.avatarPhotos, DriverDocEnum.AVATAR)
  ].filter(Boolean);

  // Save bank details
  await DriverBankDetail.updateOne(
    { driverId },
    { $set: { ...bankDetails, updatedAt: new Date() } },
    { upsert: true }
  );

  // Save vehicle details
  await VehicleDetail.updateOne(
    { driverId },
    {
      $set: {
        ...vehicleDetails,
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );

  // Save documents in DB
  await DriverDocDetails.create({ driverId, documents: normalizedDocs });

  // Generate driver token
  const driverToken = await generateTokens({ driverId });
  const populatedDriver = await DriverBasicDetails.findOne({ driverId })
    .populate("createdById", "name email role");

  // Build response documents
  const allDocuments = {};
  normalizedDocs.forEach(doc => {
    if (doc.documentType === DriverDocEnum.IDCARD) allDocuments.idCard = doc;
    if (doc.documentType === DriverDocEnum.LICENSE) allDocuments.license = doc;
    if (doc.documentType === DriverDocEnum.PASSBOOK) allDocuments.passbook = doc;
    if (doc.documentType === DriverDocEnum.INSURANCE) allDocuments.insurance = doc;
    if (doc.documentType === DriverDocEnum.REGISTRATION) allDocuments.registrationCertificate = doc;
    if (doc.documentType === DriverDocEnum.VEHICLEPHOTO) allDocuments.vehicleBikePhotos = doc;
    if (doc.documentType === DriverDocEnum.AVATAR) allDocuments.avatarPhotos = doc;
  });

  // Remove duplicate docs from bikeDetails
  const { insurance, registrationCertificate, vehiclePhotos, avatarPhotos, ...cleanBikeDetails } = vehicleDetails;

  // Response
  return res.status(statusCode.CREATED).json(
    new ApiResponse(
      statusCode.CREATED,
      {
        BikeDriverDetails: {
          driverId: savedDriver.driverId,
          name: savedDriver.fullName,
          age: savedDriver.age,
          mobile: savedDriver.phoneNo,
          email: savedDriver.email,
          address: savedDriver.address,
          status: savedDriver.status,
          experience: savedDriver.experience,
          createdById: populatedDriver.createdById,
        },
        documents: allDocuments,   // ✅ only here
        bikeDetails: cleanBikeDetails, // ✅ no duplicate docs here
        bankDetails: bankDetails,
        isOnline: false,
        token: driverToken,
      },
      "Bike driver onboarded successfully by admin"
    )
  );
});
const updateBikeDriverByAdmin = catchAsyncError(async (req, res) => {
  const { driverId } = req.params;
   const { vehicleType } = req.query
  const { basicDriverDetails = {}, bankDetails = {}, vehicleDetails = {}, documents = [] } = req.body;

 if (!driverId ||!vehicleType) {
    throw new ApiError(statusCode.BAD_REQUEST, "Driver ID  and vehileType is required");
  }
   if (vehicleType?.toLowerCase() !== "bike") {
    throw new ApiError(statusCode.BAD_REQUEST, "vehicleType must be 'bike'");
  
  }
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Access token is missing or invalid");
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const adminId = decoded?._id;

  // 1️⃣ Check if driver exists
  const savedDriver = await DriverBasicDetails.findOne({ driverId });
  if (!savedDriver) throw new ApiError(statusCode.NOT_FOUND, "Driver not found");

  // 2️⃣ Update driver basic details
  await DriverBasicDetails.updateOne(
    { driverId },
    {
      ...basicDriverDetails,
      updatedAt: new Date(),
      updatedAtById: adminId,
    }
  );

  // 3️⃣ Update bank details
  await DriverBankDetail.updateOne(
    { driverId },
    { ...bankDetails, updatedAt: new Date() },
    { upsert: true }
  );

  // 4️⃣ Update vehicle details
  await VehicleDetail.updateOne(
    { driverId },
    { ...vehicleDetails, updatedAt: new Date() },
    { upsert: true }
  );

  // 5️⃣ Collect & normalize all documents
  const normalizeDoc = (doc, type) => {
    if (!doc) return null;
    return {
      documentType: type,
      fileUrl: doc.fileUrl || doc.url,
      fileName: doc.fileName,
      status: DriverDocStatusEnum.APPROVED,
    };
  };

  const allDocuments = [
    ...documents.map(doc => normalizeDoc(doc, doc.documentType)),
    normalizeDoc(bankDetails.document, DriverDocEnum.PASSBOOK),
    normalizeDoc(vehicleDetails.insurance, DriverDocEnum.INSURANCE),
    normalizeDoc(vehicleDetails.registrationCertificate, DriverDocEnum.REGISTRATION),
    normalizeDoc(vehicleDetails.vehiclePhotos, DriverDocEnum.VEHICLEPHOTO),
    normalizeDoc(vehicleDetails.avatarPhotos, DriverDocEnum.AVATAR)
  ].filter(Boolean);

  if (allDocuments.length > 0) {
    await DriverDocDetails.findOneAndUpdate(
      { driverId },
      { documents: allDocuments },
      { upsert: true }
    );
  }

  // 6️⃣ Generate token
  const driverToken = await generateTokens({ driverId });
  const updatedDriver = await DriverBasicDetails.findOne({ driverId })
    .populate("updatedAtById", "name email role");

  // 7️⃣ Prepare documents in clean response format
  const docResponse = {};
  allDocuments.forEach(doc => {
    if (doc.documentType === DriverDocEnum.IDCARD) docResponse.idCard = doc;
    if (doc.documentType === DriverDocEnum.LICENSE) docResponse.license = doc;
    if (doc.documentType === DriverDocEnum.PASSBOOK) docResponse.passbook = doc;
    if (doc.documentType === DriverDocEnum.INSURANCE) docResponse.insurance = doc;
    if (doc.documentType === DriverDocEnum.REGISTRATION) docResponse.registrationCertificate = doc;
    if (doc.documentType === DriverDocEnum.VEHICLEPHOTO) docResponse.vehicleBikePhotos = doc;
    if (doc.documentType === DriverDocEnum.AVATAR) docResponse.avatarPhotos = doc;
  });

  // 🚨 Clean bikeDetails (remove embedded docs)
  const { insurance, registrationCertificate, vehiclePhotos, avatarPhotos, ...cleanBikeDetails } = vehicleDetails;

  // ✅ Final Response
  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        BikeDriverDetails: {
          driverId: savedDriver.driverId,
          name: basicDriverDetails.fullName || savedDriver.fullName,
          age: basicDriverDetails.age || savedDriver.age,
          mobile: basicDriverDetails.phoneNo || savedDriver.phoneNo,
          email: basicDriverDetails.email || savedDriver.email,
          address: basicDriverDetails.address || savedDriver.address,
          status: basicDriverDetails.status || savedDriver.status,
          experience: basicDriverDetails.experience || savedDriver.experience,
          createdById: savedDriver.createdById,
          updatedBy: updatedDriver.updatedAtById
        },
        documents: docResponse,
        bikeDetails: cleanBikeDetails,
        bankDetails,
        isOnline: false,
        token: driverToken
      },
      "Bike driver updated successfully by admin"
    )
  );
});
const createTaxiDriverFromAdmin = catchAsyncError(async (req, res) => {
  const {
    basicDriverDetails = {},
    bankDetails = {},
    vehicleDetails = {},
    documents = []
  } = req.body;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Access token is missing or invalid");
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const adminId = decoded?._id;

  if (!adminId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid admin token");
  }

  if (decoded.role?.toLowerCase() !== "admin") {
    throw new ApiError(statusCode.FORBIDDEN, "Only admins can create approved drivers");
  }

  basicDriverDetails.status = DriverBasicStatus.APPROVED;
  basicDriverDetails.createdBy = "admin";
  basicDriverDetails.createdById = adminId;

  const existingDriver = await DriverBasicDetails.findOne({
    $or: [
      { phoneNo: basicDriverDetails.phoneNo },
      { email: basicDriverDetails.email }
    ]
  });
  if (existingDriver) throw new ApiError(statusCode.BAD_REQUEST, "Phone number or email already exists");

  const existingVehicle = await VehicleDetail.findOne({
    registrationNo: vehicleDetails.registrationNo
  });
  if (existingVehicle) throw new ApiError(statusCode.BAD_REQUEST, "Vehicle registration number already exists");

  const driverId = await generateCustomId("driver", "D");

  const savedDriver = await DriverBasicDetails.create({
    ...basicDriverDetails,
    driverId,
    emailVerified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const normalizeDoc = (doc, documentType) => {
    if (!doc) return null;
    return {
      documentType,
      fileUrl: doc.fileUrl || doc.url,
      fileName: doc.fileName,
      status: DriverDocStatusEnum.APPROVED
    };
  };

  const normalizedDocs = [
    ...documents.map(doc => normalizeDoc(doc, doc.documentType)),
    normalizeDoc(bankDetails.document, DriverDocEnum.PASSBOOK),
    normalizeDoc(vehicleDetails.insurance, DriverDocEnum.INSURANCE),
    normalizeDoc(vehicleDetails.registrationCertificate, DriverDocEnum.REGISTRATION),
    normalizeDoc(vehicleDetails.vehiclePhotos, DriverDocEnum.VEHICLEPHOTO),
    normalizeDoc(vehicleDetails.avatarPhotos, DriverDocEnum.AVATAR)
  ].filter(Boolean);

  await DriverBankDetail.updateOne(
    { driverId },
    { $set: { ...bankDetails, updatedAt: new Date() } },
    { upsert: true }
  );

  await VehicleDetail.updateOne(
    { driverId },
    { $set: { ...vehicleDetails, updatedAt: new Date() } },
    { upsert: true }
  );

  await DriverDocDetails.create({ driverId, documents: normalizedDocs });

  const driverToken = await generateTokens({ driverId });
  const populatedDriver = await DriverBasicDetails.findOne({ driverId })
    .populate("createdById", "name email role");

  // Build response documents
  const allDocuments = {};
  normalizedDocs.forEach(doc => {
    if (doc.documentType === DriverDocEnum.IDCARD) allDocuments.idCard = doc;
    if (doc.documentType === DriverDocEnum.LICENSE) allDocuments.license = doc;
    if (doc.documentType === DriverDocEnum.PASSBOOK) allDocuments.passbook = doc;
    if (doc.documentType === DriverDocEnum.INSURANCE) allDocuments.insurance = doc;
    if (doc.documentType === DriverDocEnum.REGISTRATION) allDocuments.registrationCertificate = doc;
    if (doc.documentType === DriverDocEnum.VEHICLEPHOTO) allDocuments.vehicleTaxiPhotos = doc;
    if (doc.documentType === DriverDocEnum.AVATAR) allDocuments.avatarPhotos = doc;
  });

  // Remove documents from taxiDetails
  const { insurance, registrationCertificate, vehiclePhotos, avatarPhotos, ...cleanTaxiDetails } = vehicleDetails;

  return res.status(statusCode.CREATED).json(
    new ApiResponse(
      statusCode.CREATED,
      {
        TaxiDriverDetails: {
          driverId: savedDriver.driverId,
          name: savedDriver.fullName,
          age: savedDriver.age,
          mobile: savedDriver.phoneNo,
          email: savedDriver.email,
          address: savedDriver.address,
          status: savedDriver.status,
          experience: savedDriver.experience,
          createdById: populatedDriver.createdById,
        },
        documents: allDocuments,        // ✅ vehicleTaxiPhotos now here
        taxiDetails: cleanTaxiDetails,  // ✅ clean, no nested photos
        bankDetails: bankDetails,
        isOnline: false,
        token: driverToken,
      },
      "Taxi driver onboarded successfully by admin"
    )
  );
});
const updateTaxiDriverByAdmin = catchAsyncError(async (req, res) => {
  const { driverId } = req.params;
   const { vehicleType } = req.query
  const { basicDriverDetails = {}, bankDetails = {}, vehicleDetails = {}, documents = [] } = req.body;

  if (!driverId ||!vehicleType) {
    throw new ApiError(statusCode.BAD_REQUEST, "Driver ID  and vehileType is required");
  }
   if (vehicleType?.toLowerCase() !== "taxi") {
    throw new ApiError(statusCode.BAD_REQUEST, "vehicleType must be 'taxi'");
  
  }
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Access token is missing or invalid");
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const adminId = decoded?._id;

  // 1️⃣ Check if driver exists
  const savedDriver = await DriverBasicDetails.findOne({ driverId });
  if (!savedDriver) throw new ApiError(statusCode.NOT_FOUND, "Driver not found");

  // 2️⃣ Update driver basic details
  await DriverBasicDetails.updateOne(
    { driverId },
    {
      ...basicDriverDetails,
      updatedAt: new Date(),
      updatedAtById: adminId,
    }
  );

  // 3️⃣ Update bank details
  await DriverBankDetail.updateOne(
    { driverId },
    { ...bankDetails, updatedAt: new Date() },
    { upsert: true }
  );

  // 4️⃣ Update vehicle details
  await VehicleDetail.updateOne(
    { driverId },
    { ...vehicleDetails, updatedAt: new Date() },
    { upsert: true }
  );

  // 5️⃣ Collect & normalize all documents
  const normalizeDoc = (doc, type) => {
    if (!doc) return null;
    return {
      documentType: type,
      fileUrl: doc.fileUrl || doc.url,
      fileName: doc.fileName,
      status: DriverDocStatusEnum.APPROVED,
    };
  };

  const allDocuments = [
    ...documents.map(doc => normalizeDoc(doc, doc.documentType)),
    normalizeDoc(bankDetails.document, DriverDocEnum.PASSBOOK),
    normalizeDoc(vehicleDetails.insurance, DriverDocEnum.INSURANCE),
    normalizeDoc(vehicleDetails.registrationCertificate, DriverDocEnum.REGISTRATION),
    normalizeDoc(vehicleDetails.vehiclePhotos, DriverDocEnum.VEHICLEPHOTO),
    normalizeDoc(vehicleDetails.avatarPhotos, DriverDocEnum.AVATAR)
  ].filter(Boolean);

  if (allDocuments.length > 0) {
    await DriverDocDetails.findOneAndUpdate(
      { driverId },
      { documents: allDocuments },
      { upsert: true }
    );
  }

  // 6️⃣ Generate token
  const driverToken = await generateTokens({ driverId });
  const updatedDriver = await DriverBasicDetails.findOne({ driverId })
    .populate("updatedAtById", "name email role");

  // 7️⃣ Prepare documents in clean response format
  const docResponse = {};
  allDocuments.forEach(doc => {
    if (doc.documentType === DriverDocEnum.IDCARD) docResponse.idCard = doc;
    if (doc.documentType === DriverDocEnum.LICENSE) docResponse.license = doc;
    if (doc.documentType === DriverDocEnum.PASSBOOK) docResponse.passbook = doc;
    if (doc.documentType === DriverDocEnum.INSURANCE) docResponse.insurance = doc;
    if (doc.documentType === DriverDocEnum.REGISTRATION) docResponse.registrationCertificate = doc;
    if (doc.documentType === DriverDocEnum.VEHICLEPHOTO) docResponse.vehicleTaxiPhotos = doc; // 🚖 Taxi specific
    if (doc.documentType === DriverDocEnum.AVATAR) docResponse.avatarPhotos = doc;
  });

  // 🚨 Clean taxiDetails (remove embedded docs)
  const { insurance, registrationCertificate, vehiclePhotos, avatarPhotos, ...cleanTaxiDetails } = vehicleDetails;

  // ✅ Final Response
  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        TaxiDriverDetails: {
          driverId: savedDriver.driverId,
          name: basicDriverDetails.fullName || savedDriver.fullName,
          age: basicDriverDetails.age || savedDriver.age,
          mobile: basicDriverDetails.phoneNo || savedDriver.phoneNo,
          email: basicDriverDetails.email || savedDriver.email,
          address: basicDriverDetails.address || savedDriver.address,
          status: basicDriverDetails.status || savedDriver.status,
          experience: basicDriverDetails.experience || savedDriver.experience,
          createdById: savedDriver.createdById,
          updatedBy: updatedDriver.updatedAtById
        },
        documents: docResponse,
        taxiDetails: cleanTaxiDetails,
        bankDetails,
        isOnline: false,
        token: driverToken
      },
      "Taxi driver updated successfully by admin"
    )
  );
});
const getTaxiDriverDetailsById = catchAsyncError(async (req, res) => {
  const { driverId } = req.params;
   const {vehicleType } = req.query
   console.log(vehicleType)
  

  if (!driverId ||!vehicleType) {
    throw new ApiError(statusCode.BAD_REQUEST, "Driver ID  and vehileType is required");
  }
   if (vehicleType?.toLowerCase() !== "taxi") {
    throw new ApiError(statusCode.BAD_REQUEST, "vehicleType must be 'taxi'");
  
  }
  // Fetch driver with populated admin references
  const basicDetails = await DriverBasicDetails.findOne({ driverId })
    .populate("createdById", "name email role")
    .populate("updatedAtById", "name email role")
    .lean();

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
          documentType: doc.documentType,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          status: doc.status,
        }
      : null;
  };

  const response = {
    success: true,
    message: "Taxi driver details fetched successfully",
    statusCode: statusCode.OK,
    data: {
      TaxiDriverDetails: {
        driverId: basicDetails.driverId,
        name: basicDetails.fullName,
        age: basicDetails.age,
        mobile: basicDetails.phoneNo,
        email: basicDetails.email,
        address: basicDetails.address,
        status: basicDetails.status,
        experience: basicDetails.experience || 0,
        createdById: basicDetails.createdById, // populated { _id, email, role }
        updatedById: basicDetails.updatedAtById,
      },
      documents: {
        idCard: findDoc(DriverDocEnum.IDCARD),
        license: findDoc(DriverDocEnum.LICENSE),
        passbook: findDoc(DriverDocEnum.PASSBOOK),
        insurance: findDoc(DriverDocEnum.INSURANCE),
        registrationCertificate: findDoc(DriverDocEnum.REGISTRATION),
        vehicleTaxiPhotos: findDoc(DriverDocEnum.VEHICLEPHOTO), // 🚕 renamed
        avatarPhotos: findDoc(DriverDocEnum.AVATAR),
      },
      taxiDetails: vehicleDetails
        ? {
            seats: vehicleDetails.seats || 4, // default for taxi
            model: vehicleDetails.model,
            registrationNo: vehicleDetails.registrationNo,
            vehicleType: vehicleDetails.vehicleType,
          }
        : null,
      bankDetails: bankDetails
        ? {
            accountNumber: bankDetails.accountNumber,
            holderName: bankDetails.holderName,
            document: findDoc(DriverDocEnum.PASSBOOK),
          }
        : null,
      isOnline,
    },
  };

  return res.status(statusCode.OK).json(response);
});

const getAllBikeBookings = catchAsyncError(async (req, res) => {
  const {
    status,
    bookingId,
    from,
    to,
    vehicleType, // required
    page = 1,
    limit = 10,
  } = req.query;

  if (!vehicleType) {
    throw new ApiError(statusCode.BAD_REQUEST, "vehicleType query parameter is required");
  }

  const matchConditions = {};
  if (status) matchConditions.rideStatus = status;
  if (bookingId) matchConditions.bookingId = bookingId;
  if (from) matchConditions.fromCity = { $regex: from, $options: "i" };
  if (to) matchConditions.toCity = { $regex: to, $options: "i" };

  const pipeline = [
    { $addFields: { userIdObj: { $toObjectId: "$userId" } } },

    {
      $lookup: {
        from: "users",
        localField: "userIdObj",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "driverbasicdetails",
        localField: "driverId",
        foreignField: "driverId",
        as: "driver",
      },
    },
    { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "vehicledetails",
        localField: "driverId",
        foreignField: "driverId",
        as: "vehicle",
      },
    },
    { $unwind: { path: "$vehicle", preserveNullAndEmptyArrays: true } },

    {
      $addFields: {
        fromCity: { $arrayElemAt: [{ $split: ["$pickupLocation.address", ","] }, 2] },
        toCity: { $arrayElemAt: [{ $split: ["$dropLocation.address", ","] }, 1] },
      },
    },

    {
      $match: {
        ...matchConditions,
        "vehicle.vehicleType": vehicleType, // required
      },
    },

    {
      $project: {
        bookingId: 1,
        customerName: { $ifNull: ["$user.fullName", "N/A"] },
        riderName: { $ifNull: ["$driver.fullName", "N/A"] },
        from: "$fromCity",
        to: "$toCity",
        rideDate: { $ifNull: ["$timestamps.requestedAt", "$createdAt"] },
        vehicleType: "$vehicle.vehicleType",
        amount: "$fare",
        status: "$rideStatus",
      },
    },

    { $sort: { rideDate: -1 } },
    { $skip: (parseInt(page) - 1) * parseInt(limit) },
    { $limit: parseInt(limit) },
  ];

  const totalCountPipeline = [...pipeline];
  totalCountPipeline.push({ $count: "total" });
  const totalResult = await RideBookingDetail.aggregate(totalCountPipeline);
  const totalBookings = totalResult[0]?.total || 0;

  const bookings = await RideBookingDetail.aggregate(pipeline);

  // Dynamic message based on vehicleType and booking count
  const vehicleNameCapitalized = vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1);
  const message =
    totalBookings > 0
      ? `All ${vehicleType} bookings fetched successfully`
      : `No ${vehicleType} bookings found`;

  return res.status(200).json({
    success: true,
    statusCode: 200,
    message,
    totalBookings,
    page: parseInt(page),
    limit: parseInt(limit),
    data: bookings,
  });
});

const getBookingDetailsById = catchAsyncError(async (req, res) => {
  const { bookingId } = req.params;

  if (!bookingId) {
    throw new ApiError(statusCode.BAD_REQUEST, "Booking ID is required");
  }

  const pipeline = [
    { $match: { bookingId } },

    // Convert userId string to ObjectId for lookup
    { $addFields: { userIdObj: { $toObjectId: "$userId" } } },

    // Lookup user details
    {
      $lookup: {
        from: "users",
        localField: "userIdObj",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

    // Lookup driver details
    {
      $lookup: {
        from: "driverbasicdetails",
        localField: "driverId",
        foreignField: "driverId",
        as: "driver",
      },
    },
    { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },

    // Lookup vehicle details
    {
      $lookup: {
        from: "vehicledetails",
        localField: "driverId",
        foreignField: "driverId",
        as: "vehicle",
      },
    },
    { $unwind: { path: "$vehicle", preserveNullAndEmptyArrays: true } },
  ];

  const [booking] = await RideBookingDetail.aggregate(pipeline);

  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }

  const extractCity = (address) => {
    if (!address) return "N/A";
    const parts = address.split(",");
    return parts.length >= 2 ? parts[parts.length - 3].trim() : parts[0].trim();
  };

  const fromCity = extractCity(booking.pickupLocation?.address);
  const toCity = extractCity(booking.dropLocation?.address);

  return res.status(statusCode.OK).json({
    success: true,
    statusCode: statusCode.OK,
    message: "Booking details fetched successfully",
    bookingDetails: {
      bookingId: booking.bookingId,
      status: booking.rideStatus,
      vehicleType: booking.vehicle?.vehicleType || "N/A",
      amount: `$${booking.fare.toFixed(2)}`,
      rideDetails: {
        from: fromCity,
        to: toCity,
        rideDate: booking.timestamps?.requestedAt
          ? new Date(booking.timestamps.requestedAt).toISOString().split("T")[0]
          : "N/A",
      },
      customerInformation: booking.user?.fullName || "N/A",
      riderInformation: booking.driver?.fullName || "N/A",
    },
  });
});














module.exports = {
  getAllDrivers,
  getdriverDetailsById,
  verifyUserProfile,
  createBikeDriverFromAdmin,
  updateBikeDriverByAdmin,
  createTaxiDriverFromAdmin,
   updateTaxiDriverByAdmin,
   getTaxiDriverDetailsById,
    getAllBikeBookings,
    getBookingDetailsById




}; 



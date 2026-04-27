const {
  getAllUsersByAdmin,
  userVerifiedByAdmin,
  getUserByIdByAdmin,
} = require("../../../utils/services/admin.services");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const AdminModel = require("../../../models/admin-module/admin/admin.model");
const DriverBankDetail = require("../../../models/new-driver-module/bank-details/bank-details.model");
const DriverDocDetails = require("../../../models/new-driver-module/documents/driver-documents.model");
const DriverBasicDetails = require("../../../models/new-driver-module/basic-details/basic-details.model");
const VehicleDetail = require("../../../models/new-driver-module/vehicle-details/vehicle-details.model");
const {
  getVehicleDetailsWithDocs,
} = require("../../new-driver-module/aggregations/vehicle-details.aggregations");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  addBankDetailsValidation,
} = require("../../new-driver-module/validations/bank-details.validation");
const {
  DriverDocEnum,
  DriverDocStatusEnum,
} = require("../../../utils/constants/ENUM");
const RideBookingDetail = require("../../../models/new-driver-module/booking-details/booking-details.model");

const {
  addVehicleDetailsValidation,
} = require("../../new-driver-module/validations/vehicle-details.validations");
const statusCode = require("../../../utils/constants/statusCode");
const {
  decodeAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const { VehicleTypeEnum } = require("../../../utils/constants/ENUM");
const DriverLocation = require("../../../models/new-driver-module/location/driver-location.model");
const {
  addBasicDetailsValidation,
} = require("../../new-driver-module/validations/basic-details.validation");
const generateCustomId = require("../../../utils/customId/generateCustomId");
const { DriverBasicStatus } = require("../../../utils/constants/ENUM");
const { generateTokens } = require("../../../utils/jwtToken/generateTokens");
const UserModel = require("../../../models/user-module/users/user.model");
const WalletModel = require("../../../models/wallet-module/wallets.model");
const {
  BranchModel,
} = require("../../../models/admin-module/branch/branches.model");
const { translateLn } = require("../../../utils/services/translator.service");

const getAllDrivers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { vehicleType, search, filter, verificationStatus, batchVerified } =
      req.query;

    // ✅ Validate vehicleType
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

    // ✅ Validate filter (optional)
    const allowedFilters = ["pending", "approved", "blocked", "rejected"];
    if (filter && !allowedFilters.includes(filter)) {
      return res.status(400).json({
        success: false,
        message: `Invalid filter value. Allowed values: ${allowedFilters.join(", ")}`,
      });
    }

    // ✅ Vehicle filter
    const vehicleMatch = { "vehicleInfo.vehicleType": vehicleType };

    let branchFilter = {};
    if (req.user.role !== "SuperAdmin") {
      branchFilter = { branch: req.user.branch };
    }

    let searchFilter = {};
    if (search) {
      const regex = { $regex: search, $options: "i" };
      searchFilter = {
        $or: [
          { driverId: regex },
          { fullName: regex },
          { email: regex },
          { phoneNo: regex },

          { "vehicleInfo.registrationNo": regex },
        ],
      };
    }

    let verificationStatusFilter = {};
    const allowedStatuses = ["pending", "approved", "blocked", "rejected"];
    if (verificationStatus && allowedStatuses.includes(verificationStatus)) {
      verificationStatusFilter = { status: verificationStatus };
    }

    let batchVerifiedFilter = {};
    if (batchVerified === "true" || batchVerified === "false") {
      batchVerifiedFilter = { batchVerified: batchVerified === "true" };
    }

    // ✅ Fetch drivers with pagination (+ wallets)
    const drivers = await DriverBasicDetails.aggregate([
      // join vehicle details
      {
        $lookup: {
          from: "vehicledetails",
          localField: "driverId",
          foreignField: "driverId",
          as: "vehicleInfo",
        },
      },
      { $unwind: { path: "$vehicleInfo", preserveNullAndEmptyArrays: true } },

      // join wallets
      {
        $lookup: {
          from: "wallets",
          localField: "driverId",
          foreignField: "userId",
          as: "wallet",
        },
      },
      { $unwind: { path: "$wallet", preserveNullAndEmptyArrays: true } },

      {
        $match: {
          ...vehicleMatch,
          ...branchFilter,
          ...searchFilter,
          ...verificationStatusFilter,
          ...batchVerifiedFilter,
        },
      },
      { $sort: { createdAt: -1 } },
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
          branch: 1,
          vehicleType: "$vehicleInfo.vehicleType",
          registrationNumber: "$vehicleInfo.registrationNo",
          batchVerified: 1,
          createdAt: 1,

          cardNumber: "$wallet.cardNumber",
          balance: { $ifNull: ["$wallet.balance", 0] },
        },
      },
    ]);

    // ✅ Count total results
    const totalCount = await DriverBasicDetails.aggregate([
      {
        $lookup: {
          from: "vehicledetails",
          localField: "driverId",
          foreignField: "driverId",
          as: "vehicleInfo",
        },
      },
      { $unwind: { path: "$vehicleInfo", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          ...vehicleMatch,
          ...branchFilter,
          ...searchFilter,
          ...verificationStatusFilter,
          ...batchVerifiedFilter,
        },
      },
      { $group: { _id: "$driverId" } },
      { $count: "total" },
    ]);

    const total = totalCount[0]?.total || 0;

    res.status(200).json({
      success: true,
      message: "Drivers fetched successfully",
      total,
      page,
      limit,
      sortBy: "createdAt",
      order: "desc",
      filter: filter || null,
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
  const { vehicleType } = req.query;

  if (!driverId || !vehicleType) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Driver ID  and vehileType is required"
    );
  }
  if (vehicleType?.toLowerCase() !== "bike") {
    throw new ApiError(statusCode.BAD_REQUEST, "vehicleType must be 'bike'");
  }

  const basicDetails = await DriverBasicDetails.findOne({ driverId })
    .populate("createdById", "name email role")
    .populate("updatedAtById", "name email role")
    .populate("branch", "name location")
    .populate("verifiedBy", "userName email phoneNo role")
    .populate("batchVerifiedBy", "userName email phoneNo role")
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
  //  const findDocs = (type) => {
  //   const docs = allDocs.filter((d) => d.documentType === type);
  //   return docs.map((doc) => ({
  //     documentType: doc.documentType,
  //     fileName: doc.fileName,
  //     fileUrl: doc.fileUrl,
  //     status: doc.status,
  //   }));
  // };

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
        branch: basicDetails.branch || null,
        batchVerified: basicDetails.batchVerified,
        batchVerifiedBy: basicDetails.batchVerifiedBy || null,
        // Only include remarks if status is blocked or rejected
        ...(["blocked", "rejected"].includes(
          basicDetails.status.toLowerCase()
        ) && {
          remarks: basicDetails.remarks || null,
        }), // ✅ add branch here
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
  const adminId = req.user && req.user._id ? req.user._id : null;
  const { driverId } = req.params;
  const { status, remarks, batchVerified } = req.body;

  if (!driverId || !status) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Driver ID and status are required"
    );
  }

  if (
    status.toLowerCase() === "blocked" &&
    (!remarks || remarks.trim() === "")
  ) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Remarks are required when blocking a user"
    );
  }

  await DriverBasicDetails.findOneAndUpdate(
    { driverId },
    {
      $set: {
        status,
      },
    },
    { new: true }
  );
  if (["blocked", "rejected"].includes(status.toLowerCase())) {
    await DriverBasicDetails.findOneAndUpdate(
      { driverId },
      { $set: { remarks: remarks.trim() } }
    );
  } else {
    await DriverBasicDetails.findOneAndUpdate(
      { driverId },
      { $set: { remarks: "" } }
    );
  }

  if (typeof batchVerified === "boolean") {
    await DriverBasicDetails.findOneAndUpdate(
      { driverId },
      {
        $set: {
          batchVerified,
          batchVerifiedBy: batchVerified ? adminId : null,
        },
      }
    );
  }

  await DriverDocDetails.updateMany(
    { driverId },
    { $set: { "documents.$[].status": status } } // Updates all docs in array
  );

  const basicDetails = await DriverBasicDetails.findOne({ driverId })
    .populate({
      path: "batchVerifiedBy",
      select: "fullName email phoneNo role", // or other fields from Admin model
    })
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
        batchVerified: basicDetails.batchVerified,
        batchVerifiedBy: basicDetails.batchVerifiedBy,
        ...(["blocked", "rejected"].includes(
          basicDetails.status.toLowerCase()
        ) && {
          remarks: basicDetails.remarks || null,
        }),
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

const createBikeDriverFromAdmin = catchAsyncError(async (req, res) => {
  const {
    basicDriverDetails = {},
    bankDetails = {},
    vehicleDetails = {},
    documents = [],
  } = req.body;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const adminId = decoded?._id;

  if (!adminId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid admin token");
  }

  // Ensure only admins can create approved drivers

  // Auto-set admin creation details
  basicDriverDetails.status = DriverBasicStatus.APPROVED;
  basicDriverDetails.createdBy = "admin";
  basicDriverDetails.createdById = adminId;

  if (basicDriverDetails.email) {
    const emailExists = await DriverBasicDetails.findOne({
      email: basicDriverDetails.email,
    });
    if (emailExists) {
      throw new ApiError(statusCode.BAD_REQUEST, "Email already exists");
    }
  }
  const phoneExists = await DriverBasicDetails.findOne({
    phoneNo: basicDriverDetails.phoneNo,
  });
  if (phoneExists) {
    throw new ApiError(statusCode.BAD_REQUEST, "Phone number already exists");
  }

  const existingVehicle = await VehicleDetail.findOne({
    registrationNo: vehicleDetails.registrationNo,
  });
  if (existingVehicle) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Vehicle registration number already exists"
    );
  }

  if (basicDriverDetails.branch) {
    basicDriverDetails.branch = new ObjectId(basicDriverDetails.branch);

    const branchDoc = await BranchModel.findById(basicDriverDetails.branch);
    if (!branchDoc) {
      throw new ApiError(statusCode.BAD_REQUEST, "Invalid branch selected");
    }
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
      status: DriverDocStatusEnum.APPROVED,
    };
  };

  const vehiclePhotoDocs = Array.isArray(vehicleDetails.vehiclePhotos)
    ? vehicleDetails.vehiclePhotos.map((photo) =>
        normalizeDoc(photo, DriverDocEnum.VEHICLEPHOTO)
      )
    : vehicleDetails.vehiclePhotos
      ? [normalizeDoc(vehicleDetails.vehiclePhotos, DriverDocEnum.VEHICLEPHOTO)]
      : [];

  const normalizedDocs = [
    ...documents.map((doc) => normalizeDoc(doc, doc.documentType)),
    normalizeDoc(bankDetails.document, DriverDocEnum.PASSBOOK),
    normalizeDoc(vehicleDetails.insurance, DriverDocEnum.INSURANCE),
    normalizeDoc(
      vehicleDetails.registrationCertificate,
      DriverDocEnum.REGISTRATION
    ),
    ...vehiclePhotoDocs,
    normalizeDoc(vehicleDetails.avatarPhotos, DriverDocEnum.AVATAR),
  ].filter(Boolean);
  await DriverBankDetail.updateOne(
    { driverId },
    { $set: { ...bankDetails, updatedAt: new Date() } },
    { upsert: true }
  );

  await VehicleDetail.updateOne(
    { driverId },
    {
      $set: {
        ...vehicleDetails,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
  await DriverDocDetails.create({ driverId, documents: normalizedDocs });

  const driverToken = await generateTokens({ driverId });
  const populatedDriver = await DriverBasicDetails.findOne({
    driverId,
  })
    .populate("createdById", "name email role")
    .populate("branch", "name location");
  const allDocuments = {
    vehicleBikePhotos: [],
  };
  normalizedDocs.forEach((doc) => {
    if (doc.documentType === DriverDocEnum.IDCARD) allDocuments.idCard = doc;
    if (doc.documentType === DriverDocEnum.LICENSE) allDocuments.license = doc;
    if (doc.documentType === DriverDocEnum.PASSBOOK)
      allDocuments.passbook = doc;
    if (doc.documentType === DriverDocEnum.INSURANCE)
      allDocuments.insurance = doc;
    if (doc.documentType === DriverDocEnum.REGISTRATION)
      allDocuments.registrationCertificate = doc;
    if (doc.documentType === DriverDocEnum.VEHICLEPHOTO)
      allDocuments.vehicleBikePhotos.push(doc);
    if (doc.documentType === DriverDocEnum.AVATAR)
      allDocuments.avatarPhotos = doc;
  });

  // Remove duplicate docs from bikeDetails
  const {
    insurance,
    registrationCertificate,
    vehiclePhotos,
    avatarPhotos,
    ...cleanBikeDetails
  } = vehicleDetails;

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
        documents: allDocuments,
        bikeDetails: cleanBikeDetails,
        documents: allDocuments, // ✅ multiple bike photos supported
        bikeDetails: cleanBikeDetails, // ✅ clean, no duplicate docs
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
  const { vehicleType } = req.query;
  const {
    basicDriverDetails = {},
    bankDetails = {},
    vehicleDetails = {},
    documents = [],
  } = req.body;

  if (!driverId || !vehicleType) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Driver ID  and vehileType is required"
    );
  }
  if (vehicleType?.toLowerCase() !== "bike") {
    throw new ApiError(statusCode.BAD_REQUEST, "vehicleType must be 'bike'");
  }
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const adminId = decoded?._id;

  // 1️⃣ Check if driver exists
  const savedDriver = await DriverBasicDetails.findOne({ driverId });
  if (!savedDriver)
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
  const branch = basicDriverDetails?.branch;
  console.log("branch", branch);
  if (branch) {
    const branchDoc = await BranchModel.findById(branch);

    if (!branchDoc) {
      throw new ApiError(statusCode.BAD_REQUEST, "Invalid branch selected");
    }
    basicDriverDetails.branch = branchDoc._id;
  }

  // 2️⃣ Update driver basic details
  await DriverBasicDetails.updateOne(
    { driverId },
    {
      ...basicDriverDetails,
      status: "approved",
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
      // status: DriverDocStatusEnum.APPROVED,
    };
  };

  const allDocuments = [
    ...documents.map((doc) => normalizeDoc(doc, doc.documentType)),
    normalizeDoc(bankDetails.document, DriverDocEnum.PASSBOOK),
    normalizeDoc(vehicleDetails.insurance, DriverDocEnum.INSURANCE),
    normalizeDoc(
      vehicleDetails.registrationCertificate,
      DriverDocEnum.REGISTRATION
    ),
    normalizeDoc(vehicleDetails.vehiclePhotos, DriverDocEnum.VEHICLEPHOTO),
    normalizeDoc(vehicleDetails.avatarPhotos, DriverDocEnum.AVATAR),
  ].filter(Boolean);

  if (allDocuments.length > 0) {
    await DriverDocDetails.findOneAndUpdate(
      { driverId },
      {
        documents: allDocuments.map((doc) => ({ ...doc, status: "APPROVED" })),
      },
      { upsert: true }
    );
  }

  // 6️⃣ Generate token
  const driverToken = await generateTokens({ driverId });
  const updatedDriver = await DriverBasicDetails.findOne({ driverId }).populate(
    "updatedAtById",
    "name email role"
  );

  // 7️⃣ Prepare documents in clean response format
  const docResponse = {};
  allDocuments.forEach((doc) => {
    if (doc.documentType === DriverDocEnum.IDCARD) docResponse.idCard = doc;
    if (doc.documentType === DriverDocEnum.LICENSE) docResponse.license = doc;
    if (doc.documentType === DriverDocEnum.PASSBOOK) docResponse.passbook = doc;
    if (doc.documentType === DriverDocEnum.INSURANCE)
      docResponse.insurance = doc;
    if (doc.documentType === DriverDocEnum.REGISTRATION)
      docResponse.registrationCertificate = doc;
    if (doc.documentType === DriverDocEnum.VEHICLEPHOTO)
      docResponse.vehicleBikePhotos = doc;
    if (doc.documentType === DriverDocEnum.AVATAR)
      docResponse.avatarPhotos = doc;
  });

  // 🚨 Clean bikeDetails (remove embedded docs)
  const {
    insurance,
    registrationCertificate,
    vehiclePhotos,
    avatarPhotos,
    ...cleanBikeDetails
  } = vehicleDetails;

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
          status: "approved",

          experience: basicDriverDetails.experience || savedDriver.experience,
          createdById: savedDriver.createdById,
          updatedBy: updatedDriver.updatedAtById,
        },
        documents: docResponse,
        bikeDetails: cleanBikeDetails,
        bankDetails,
        isOnline: false,
        token: driverToken,
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
    documents = [],
  } = req.body;

  // Validate token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const adminId = decoded?._id;

  if (!adminId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid admin token");
  }

  // Set defaults for driver
  basicDriverDetails.status = DriverBasicStatus.APPROVED;
  basicDriverDetails.createdBy = "admin";
  basicDriverDetails.createdById = adminId;

  // Duplicate checks
  if (basicDriverDetails.email) {
    const emailExists = await DriverBasicDetails.findOne({
      email: basicDriverDetails.email,
    });
    if (emailExists) {
      throw new ApiError(statusCode.BAD_REQUEST, "Email already exists");
    }
  }
  if (basicDriverDetails.branch) {
    // Convert to ObjectId
    basicDriverDetails.branch = new ObjectId(basicDriverDetails.branch);

    // Optional: Check if branch exists in your Branch collection
    const branchExists = await BranchModel.findById(basicDriverDetails.branch);
    if (!branchExists) {
      throw new ApiError(statusCode.BAD_REQUEST, "Invalid branch ID");
    }
  }

  const phoneExists = await DriverBasicDetails.findOne({
    phoneNo: basicDriverDetails.phoneNo,
  });
  if (phoneExists) {
    throw new ApiError(statusCode.BAD_REQUEST, "Phone number already exists");
  }

  const existingVehicle = await VehicleDetail.findOne({
    registrationNo: vehicleDetails.registrationNo,
  });
  if (existingVehicle) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Vehicle registration number already exists"
    );
  }

  // Generate new driverId
  const driverId = await generateCustomId("driver", "D");

  // Save driver basic details
  const savedDriver = await DriverBasicDetails.create({
    ...basicDriverDetails,
    driverId,
    emailVerified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Helpers to normalize docs
  const normalizeDoc = (doc, documentType) => {
    if (!doc) return null;
    return {
      documentType,
      fileUrl: doc.fileUrl || doc.url,
      fileName: doc.fileName,
      status: DriverDocStatusEnum.APPROVED,
    };
  };

  const normalizeDocsArray = (docs, documentType) => {
    if (!Array.isArray(docs)) return [];
    return docs.map((doc) => normalizeDoc(doc, documentType)).filter(Boolean);
  };

  // Collect documents
  const normalizedDocs = [
    ...documents.map((doc) => normalizeDoc(doc, doc.documentType)),
    normalizeDoc(bankDetails.document, DriverDocEnum.PASSBOOK),
    normalizeDoc(vehicleDetails.insurance, DriverDocEnum.INSURANCE),
    normalizeDoc(
      vehicleDetails.registrationCertificate,
      DriverDocEnum.REGISTRATION
    ),
    normalizeDoc(vehicleDetails.vehiclePhotos, DriverDocEnum.VEHICLEPHOTO),
    normalizeDoc(vehicleDetails.avatarPhotos, DriverDocEnum.AVATAR), // single
  ].filter(Boolean);

  // Save bank + vehicle + documents
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

  // Generate driver token
  const driverToken = await generateTokens({ driverId });

  // Populate createdById
  const populatedDriver = await DriverBasicDetails.findOne({
    driverId,
  })
    .populate("createdById", "name email role")
    .populate("branch", "name location");

  // Build response documents
  const allDocuments = {};
  normalizedDocs.forEach((doc) => {
    if (doc.documentType === DriverDocEnum.IDCARD) allDocuments.idCard = doc;
    if (doc.documentType === DriverDocEnum.LICENSE) allDocuments.license = doc;
    if (doc.documentType === DriverDocEnum.PASSBOOK)
      allDocuments.passbook = doc;
    if (doc.documentType === DriverDocEnum.INSURANCE)
      allDocuments.insurance = doc;
    if (doc.documentType === DriverDocEnum.REGISTRATION)
      allDocuments.registrationCertificate = doc;

    if (doc.documentType === DriverDocEnum.VEHICLEPHOTO) {
      if (!allDocuments.vehicleTaxiPhotos) allDocuments.vehicleTaxiPhotos = [];
      allDocuments.vehicleTaxiPhotos.push(doc); // ✅ push array
    }

    if (doc.documentType === DriverDocEnum.AVATAR)
      allDocuments.avatarPhotos = doc;
  });

  // Clean taxiDetails (remove docs from it)
  const {
    insurance,
    registrationCertificate,
    vehiclePhotos,
    avatarPhotos,
    ...cleanTaxiDetails
  } = vehicleDetails;

  // Final response
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
          branch: populatedDriver.branch,
        },
        documents: allDocuments, // ✅ vehicleTaxiPhotos array
        taxiDetails: cleanTaxiDetails, // ✅ no nested photos
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
  const { vehicleType } = req.query;
  const {
    basicDriverDetails = {},
    bankDetails = {},
    vehicleDetails = {},
    documents = [],
  } = req.body;

  if (!driverId || !vehicleType) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Driver ID and vehicleType are required"
    );
  }

  if (vehicleType?.toLowerCase() !== "taxi") {
    throw new ApiError(statusCode.BAD_REQUEST, "vehicleType must be 'taxi'");
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const adminId = decoded?._id;

  // 1️⃣ Check if driver exists
  const savedDriver = await DriverBasicDetails.findOne({ driverId });
  if (!savedDriver)
    throw new ApiError(statusCode.NOT_FOUND, "Driver not found");

  if (basicDriverDetails.branch) {
    // Convert to ObjectId
    basicDriverDetails.branch = new ObjectId(basicDriverDetails.branch);

    // Check if branch exists in DB
    const branchExists = await BranchModel.findById(basicDriverDetails.branch);
    if (!branchExists) {
      throw new ApiError(statusCode.BAD_REQUEST, "Invalid branch ID");
    }
  }

  // 2️⃣ Update driver basic details
  await DriverBasicDetails.updateOne(
    { driverId },
    {
      ...basicDriverDetails,
      status: "approved",
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

  // 5️⃣ Helper: Normalize document with backend auto-approved status (status not included in response)
  const normalizeDoc = (doc, type) => {
    if (!doc) return null;
    return {
      documentType: type,
      fileUrl: doc.fileUrl || doc.url,
      fileName: doc.fileName || "default_file_name",
    };
  };

  // 6️⃣ Helper: Update single document (remove old, add new)
  const updateSingleDocument = async (driverId, doc) => {
    if (!doc) return;
    await DriverDocDetails.updateOne(
      { driverId },
      { $pull: { documents: { documentType: doc.documentType } } }
    );
    await DriverDocDetails.updateOne(
      { driverId },
      { $push: { documents: { ...doc, status: "APPROVED" } } }, // auto-approved in DB
      { upsert: true }
    );
  };

  // 7️⃣ Prepare all documents to update
  const allDocsToUpdate = [
    ...documents.map((d) => normalizeDoc(d, d.documentType)),
    normalizeDoc(bankDetails.document, DriverDocEnum.PASSBOOK),
    normalizeDoc(vehicleDetails.insurance, DriverDocEnum.INSURANCE),
    normalizeDoc(
      vehicleDetails.registrationCertificate,
      DriverDocEnum.REGISTRATION
    ),
    normalizeDoc(vehicleDetails.vehiclePhotos, DriverDocEnum.VEHICLEPHOTO),
    normalizeDoc(vehicleDetails.avatarPhotos, DriverDocEnum.AVATAR),
  ].filter(Boolean);

  // 8️⃣ Update each document individually
  for (const doc of allDocsToUpdate) {
    await updateSingleDocument(driverId, doc);
  }

  // 9️⃣ Generate token
  const driverToken = await generateTokens({ driverId });
  const updatedDriver = await DriverBasicDetails.findOne({ driverId }).populate(
    "updatedAtById",
    "name email role"
  );

  // 10️⃣ Prepare clean document response (status removed)
  const docResponse = {};
  allDocsToUpdate.forEach((doc) => {
    switch (doc.documentType) {
      case DriverDocEnum.IDCARD:
        docResponse.idCard = doc;
        break;
      case DriverDocEnum.LICENSE:
        docResponse.license = doc;
        break;
      case DriverDocEnum.PASSBOOK:
        docResponse.passbook = doc;
        break;
      case DriverDocEnum.INSURANCE:
        docResponse.insurance = doc;
        break;
      case DriverDocEnum.REGISTRATION:
        docResponse.registrationCertificate = doc;
        break;
      case DriverDocEnum.VEHICLEPHOTO:
        docResponse.vehicleTaxiPhotos = doc;
        break;
      case DriverDocEnum.AVATAR:
        docResponse.avatarPhotos = doc;
        break;
    }
  });

  // 11️⃣ Clean taxiDetails (remove embedded docs)
  const {
    insurance,
    registrationCertificate,
    vehiclePhotos,
    avatarPhotos,
    ...cleanTaxiDetails
  } = vehicleDetails;

  // 12️⃣ Final Response
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
          status: "approved",

          experience: basicDriverDetails.experience || savedDriver.experience,
          createdById: savedDriver.createdById,
          updatedBy: updatedDriver.updatedAtById,
        },
        documents: docResponse, // status removed here
        taxiDetails: cleanTaxiDetails,
        bankDetails,
        isOnline: false,
        token: driverToken,
      },
      "Taxi driver updated successfully by admin"
    )
  );
});

const getTaxiDriverDetailsById = catchAsyncError(async (req, res) => {
  const { driverId } = req.params;
  const { vehicleType } = req.query;
  const ln = (req.headers["ln"] || "en").toLowerCase();
  console.log(ln);

  if (!driverId || !vehicleType) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Driver ID and vehicleType are required"
    );
  }

  if (vehicleType?.toLowerCase() !== "taxi") {
    throw new ApiError(statusCode.BAD_REQUEST, "vehicleType must be 'taxi'");
  }

  // Fetch driver with populated admin references
  const basicDetails = await DriverBasicDetails.findOne({ driverId })
    .populate("createdById", "name email role")
    .populate("updatedAtById", "name email role")
    .populate("branch", "name location")
    .populate("verifiedBy", "userName email phoneNo role")
    .populate("batchVerifiedBy", "userName email phoneNo role")

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
          fileName:
            doc.fileName === "No Bank Account Details uploaded"
              ? translateLn(ln, "NO_BANK_ACCOUNT_DETAILS_UPLOADED")
              : doc.fileName,

          fileUrl:
            doc.fileUrl === "No Bank Account Details uploaded"
              ? translateLn(ln, "NO_BANK_ACCOUNT_DETAILS_UPLOADED")
              : doc.fileUrl,

          status: doc.status,
        }
      : null;
  };

  // const findDocs = (type) => {
  //   const docs = allDocs.filter((d) => d.documentType === type);
  //   return docs.map((doc) => ({
  //     documentType: doc.documentType,
  //     fileName: doc.fileName,
  //     fileUrl: doc.fileUrl,
  //     status: doc.status,
  //   }));
  // };

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
        status: translateLn(ln, basicDetails.status?.toUpperCase()),
        experience: basicDetails.experience || 0,
        createdById: basicDetails.createdById,
        updatedById: basicDetails.updatedAtById,
        branch: basicDetails.branch || null,
        batchVerified: basicDetails.batchVerified,
        batchVerifiedBy: basicDetails.batchVerifiedBy || null,
        // Only include remarks if status is blocked or rejected
        ...(["blocked", "rejected"].includes(
          basicDetails.status.toLowerCase()
        ) && {
          remarks: basicDetails.remarks || null,
        }),
      },
      documents: {
        idCard: findDoc(DriverDocEnum.IDCARD),
        license: findDoc(DriverDocEnum.LICENSE),
        passbook: findDoc(DriverDocEnum.PASSBOOK),
        insurance: findDoc(DriverDocEnum.INSURANCE),
        registrationCertificate: findDoc(DriverDocEnum.REGISTRATION),
        vehicleTaxiPhotos: findDoc(DriverDocEnum.VEHICLEPHOTO),
        avatarPhotos: findDoc(DriverDocEnum.AVATAR),
      },
      taxiDetails: vehicleDetails
        ? {
            seats: vehicleDetails.seats || 4,
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
    vehicleType, // required
    search,
    page = 1,
    limit = 10,
  } = req.query;

  if (!vehicleType) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "vehicleType query parameter is required"
    );
  }

  // ✅ Search filter across multiple fields
  let searchFilter = {};
  if (search) {
    const regex = { $regex: search, $options: "i" };
    searchFilter = {
      $or: [
        { bookingId: regex }, // booking id
        { rideStatus: regex }, // booking status
        { fromCity: regex }, // from city
        { toCity: regex }, // to city
        { "user.fullName": regex }, // customer name
        { "driver.fullName": regex }, // rider name
        { "vehicle.registrationNo": regex }, // vehicle registration
      ],
    };
  }

  // ✅ Branch filter
  let branchFilter = {};
  if (req.user.role !== "SuperAdmin") {
    branchFilter = { "driver.branch": req.user.branch };
  }

  // Common pipeline before pagination
  const basePipeline = [
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
        fromCity: {
          $arrayElemAt: [{ $split: ["$pickupLocation.address", ","] }, 2],
        },
        toCity: {
          $arrayElemAt: [{ $split: ["$dropLocation.address", ","] }, 1],
        },
      },
    },
    {
      $match: {
        "vehicle.vehicleType": vehicleType,
        ...searchFilter,
        ...branchFilter, // ✅ branch-based filtering
      },
    },
  ];

  // ✅ Total count
  const totalCountPipeline = [...basePipeline, { $count: "total" }];
  const totalResult = await RideBookingDetail.aggregate(totalCountPipeline);
  const totalBookings = totalResult[0]?.total || 0;

  // ❌ No bookings found
  if (totalBookings === 0) {
    return res.status(404).json({
      success: false,
      statusCode: 404,
      message: `No ${vehicleType} bookings found`,
      totalBookings,
      page: parseInt(page),
      limit: parseInt(limit),
      data: [],
    });
  }

  // ✅ Paginated pipeline
  const pipeline = [
    ...basePipeline,
    {
      $project: {
        bookingId: 1,
        customerName: { $ifNull: ["$user.fullName", "N/A"] },
        riderName: { $ifNull: ["$driver.fullName", "N/A"] },
        branch: "$driver.branch", // include branch in response
        from: "$fromCity",
        to: "$toCity",
        rideDate: { $ifNull: ["$timestamps.requestedAt", "$createdAt"] },
        vehicleType: "$vehicle.vehicleType",
        registrationNumber: "$vehicle.registrationNo",
        amount: "$fare",
        status: "$rideStatus",
      },
    },
    { $sort: { rideDate: -1 } },
    { $skip: (parseInt(page) - 1) * parseInt(limit) },
    { $limit: parseInt(limit) },
  ];

  const bookings = await RideBookingDetail.aggregate(pipeline);

  return res.status(200).json({
    success: true,
    statusCode: 200,
    message: `All ${vehicleType} bookings fetched successfully`,
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
      driverInformation: booking.driver?.fullName || "N/A",
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
  getBookingDetailsById,
};

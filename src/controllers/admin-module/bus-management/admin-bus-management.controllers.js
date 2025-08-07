const {
  BusOperatorBankModel,
} = require("../../../models/bus-module/bus-operator-banks/bus-operator-banks.model");
const {
  BusOperatorDocumentModel,
} = require("../../../models/bus-module/bus-operator-documents/bus-operator-document.model");
const BusOperatorModel = require("../../../models/bus-module/bus-operator/bus-operator.model");
const { DocumentsModel } = require("../../../models/global-module/documents/document.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  uploadImageOnAws,
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");
const {
  registerUserWithEmailAndPhoneNumber,
} = require("../../../utils/services/functions.services");
const {
  getAllUsersByAdmin,
  getUserByIdByAdmin,
  userVerifiedByAdmin,
} = require("../../../utils/services/admin.services");
const BusBookingModel = require("../../../models/bus-module/bus-bookings/bus-bookings.model");
const BusModel = require("../../../models/bus-module/buses/buses.model");
const BusRouteModel = require("../../../models/bus-module/bus-routes/bus-routes.model");
const multer = require("../../../utils/uploadFiles/multer");

const { TypeOfUser } = require("../../../utils/constants/constants");
const getAllBusOperators = catchAsyncError(async (req, res, next) => {



  const results = await getAllUsersByAdmin({ req, model: BusOperatorModel });

  return res.status(statusCode.OK).json(results);
});
const { validateRequestBody } = require("../../../utils/reqFunctions/reqFunction");

const getSingleUser = catchAsyncError(async (req, res, next) => {
  const result = await getUserByIdByAdmin({
    req,
    userModel: BusOperatorModel,
    userDocsModel: BusOperatorDocumentModel,
    userBankModel: BusOperatorBankModel,
    userAddressModel: BusOperatorModel,
  });

  return res.status(statusCode.OK).json(result);
});

const verifyUserProfile = catchAsyncError(async (req, res, next) => {
  const result = await userVerifiedByAdmin({ req, model: BusOperatorModel });

  return res.status(statusCode.OK).json(result);
});

const deleteBusOperatorAccount = catchAsyncError(async (req, res, next) => {
  const { userId } = req.params;

  const [user, userBank, userDocs] = await Promise.all([
    BusOperatorModel.findById(userId),
    BusOperatorBankModel.findOne({ userId }),
    BusOperatorDocumentModel.findOne({ userId }).populate("documentIds"),
  ]);

  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  // Delete bank document image if exists
  if (userBank?.bankDocs?.public_id) {
    await deleteImageFromAws(userBank.bankDocs.public_id);
  }

  // Delete user avatar
  if (user?.avatar?.public_id) {
    await deleteImageFromAws(user.avatar.public_id);
  }

  // Delete uploaded documents
  if (userDocs?.documentIds?.length > 0) {
    for (const key of userDocs.documentIds) {
      if (key?.file?.public_id) {
        await deleteImageFromAws(key.file.public_id);
      }
      await DocumentsModel.deleteOne({ _id: key._id });
    }
    await BusOperatorDocumentModel.deleteMany({ userId });
  }

  // 🔥 Missing deletions — add these:
  await Promise.all([
    BusOperatorModel.findByIdAndDelete(userId), // Delete user
    BusOperatorBankModel.deleteMany({ userId }), // Delete bank info
  ]);

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, {}, "Deleted Successfully"));
});
const registerBusOperator = catchAsyncError(async (req, res, next) => {
  const result = await registerUserWithEmailAndPhoneNumber({
    req,
    res,
    reqModel: BusOperatorModel,
    typeOfUser: TypeOfUser.BUSOPERATOR,
    createdByAdmin: true,

  });

  return res.status(statusCode.OK).json(result);
});
const updateBusOperator = catchAsyncError(async (req, res, next) => {
  const { userId } = req.params;
  const {
    companyName,
    email,
    phoneNumber,
    fullName,
    dob,
    nationality,
    companyAddress,
    nationIdExpiry,
    accountHolderName,
    accountNumber,
    bankName,
    ifscCode,
    branchName,
    isPrimary,
  } = req.body;

  const docsToUpload = req.files || {};
  const keys = Object.keys(docsToUpload);
  

  const updateData = {};
  if (email) updateData.email = email.toLowerCase();
  if (phoneNumber) {
  updateData.phoneNumber = Array.isArray(phoneNumber)
    ? phoneNumber.find((num) => !!num)?.trim()
    : phoneNumber.trim();
}
  if (companyName) updateData.companyName = companyName;
  if (companyAddress) updateData.companyAddress = companyAddress;
  if (fullName) updateData.fullName = fullName;
  if (dob) updateData.dob = dob;
  if (nationality) updateData.nationality = nationality;
  if (nationIdExpiry) updateData.nationIdExpiry = nationIdExpiry;


 
  const validDocumentTypes = ["national_identity_card_front", "national_identity_card_back"];
  const invalidKeys = keys.filter((key) => !validDocumentTypes.includes(key) && key !== "avatar" && key !== "bank_detail");
  if (invalidKeys.length > 0) {
    throw new ApiError(statusCode.BAD_REQUEST, `Invalid document types: ${invalidKeys.join(", ")}`);
  }

  const userDocument = await BusOperatorDocumentModel.findOne({ userId });
  let docsIds = [];

  for (const key of validDocumentTypes) {
    if (docsToUpload[key]) {
      const imgFile = docsToUpload[key][0];
      const cloudImage = await uploadImageOnAws(imgFile.path);

      const uploadedDoc = await DocumentsModel.create({
        documentName: key,
        documentType: key,
        file: {
          public_id: cloudImage?.public_id,
          url: cloudImage?.secure_url,
        },
        fileType: imgFile.mimetype,
        ownerId: req.user?._id,
      });

      docsIds.push(uploadedDoc._id);
    }
  }

  if (docsIds.length > 0) {
    if (!userDocument) {
      await BusOperatorDocumentModel.create({ userId, documentIds: docsIds });
    } else {
      userDocument.documentIds.push(...docsIds);
      await userDocument.save();
    }
  }
  const findBank = await BusOperatorBankModel.findOne({ userId });
  if (findBank) {
    if (accountNumber && accountNumber !== findBank.accountNumber) {
      const existingAccount = await BusOperatorBankModel.findOne({ accountNumber });
      if (existingAccount) {
        throw new ApiError(statusCode.CONFLICT, "This account number is already registered by another user.");
      }
    }

    findBank.accountHolderName = accountHolderName || findBank.accountHolderName;
    findBank.accountNumber = accountNumber || findBank.accountNumber;
    findBank.bankName = bankName || findBank.bankName;
    findBank.ifscCode = ifscCode || findBank.ifscCode;
    findBank.branchName = branchName || findBank.branchName;
   if (phoneNumber) {
  findBank.phoneNumber = Array.isArray(phoneNumber)
    ? phoneNumber.find((num) => !!num)?.trim()
    : phoneNumber.trim();
}
    findBank.isPrimary = isPrimary ?? findBank.isPrimary;
if (docsToUpload["bank_detail"]) {
  if (findBank.bankDocs?.public_id) {
    await deleteImageFromAws(findBank.bankDocs.public_id);
  }

  const imgFile = docsToUpload["bank_detail"][0]; 
  const cloudImage = await uploadImageOnAws(imgFile.path); 
  findBank.bankDocs = {
    public_id: cloudImage?.public_id,
    url: cloudImage?.secure_url,
  };
}


    await findBank.save();
  }
  const updatedUser = await BusOperatorModel.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select("-password");

  if (!updatedUser) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found.");
  }

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK,
      { user: updatedUser, bankDetails: findBank,  },
       "Bus operator profile updated successfully."));
});



const searchBusOperators = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phoneNumber,
      companyName,
      verificationStatus,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      ...filters
    } = req.query;

    const query = {};

    if (fullName) query.fullName = { $regex: new RegExp(fullName, "i") };
    if (email) query.email = { $regex: new RegExp(email, "i") };
    if (phoneNumber) query.phoneNumber = { $regex: new RegExp(phoneNumber, "i") };
    if (companyName) query.companyName = { $regex: new RegExp(companyName, "i") };
    if (verificationStatus) query.verificationStatus = { $regex: new RegExp(verificationStatus, "i") };

    for (const key in filters) {
      if (!query[key]) {
        query[key] = filters[key];
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOption = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [users, total] = await Promise.all([
      BusOperatorModel.find(query).sort(sortOption).skip(skip).limit(parseInt(limit)),
      BusOperatorModel.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: {
        users,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Search Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
const getAllBusBookings = catchAsyncError(async (req, res, next) => {
  const {
    date,
    busId,
    routeId,
    sortBy,
    order,
    limit,
    page,
    startDate,
    endDate,
    pickup,
    drop,
  } = req.query;
  // Initialize query object
  const query = {};

  

  if (startDate) {
    const selectedStartDate = moment.utc(startDate, "YYYY-MM-DD", true);

    if (!selectedStartDate.isValid()) {
      throw new ApiError(statusCode.BAD_REQUEST, "Invalid date format");
    }

    query.journeyDate = {
      $gte: normalizeDate(selectedStartDate),
      // $lte: normalizeDate(selectedEndDate),
    };
  }
  if (endDate) {
    const selectedEndDate = moment.utc(endDate, "YYYY-MM-DD", true);
    if (!selectedEndDate.isValid()) {
      throw new ApiError(statusCode.BAD_REQUEST, "Invalid date format");
    }

    query.journeyDate = {
      // $gte: normalizeDate(selectedStartDate),
      $lte: normalizeDate(selectedEndDate),
    };
  }
  if (pickup) {
    query.from = { $regex: pickup, $options: "i" };
  }
  if (drop) {
    query.to = { $regex: drop, $options: "i" };
  }

  
  if (routeId) {
    query.routeId = routeId;
  }

  const pageNumber = parseInt(page) || 1;
  const pageSize = parseInt(limit) || 10;
  const skip = (pageNumber - 1) * pageSize;

 
  const sortField = sortBy || "createdAt";
  const sortOrder = order === "desc" ? 1 : -1;

  const bookings = await BusBookingModel.find(query)
    .sort({ [sortField]: sortOrder })
    .skip(skip)
    .limit(pageSize)
    .select(
      "from to seatNumbers paymentStatus journeyDate passengers status createdAt updatedAt email phoneNumber bookedBy bookedByOperator bookingBy"
    )
    .populate("bookedBy", "fullName email phoneNumber")
    .populate("bookedByOperator", "fullName email phoneNumber")
    .populate("busId", "busRegNumber");

  if (!bookings || bookings.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "No bookings found");
  }
  const totalBookings = await BusBookingModel.countDocuments(query);

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        bookings,
        totalBookings,
        totalPages: Math.ceil(totalBookings / pageSize),
        currentPage: pageNumber,
      },
      "Bus bookings retrieved successfully"
    )
  );
});






module.exports = {
  registerBusOperator,
  updateBusOperator,
  getAllBusOperators,
  getSingleUser,
  verifyUserProfile,
  deleteBusOperatorAccount,
  searchBusOperators,
  getAllBusBookings
};

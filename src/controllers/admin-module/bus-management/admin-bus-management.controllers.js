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
  const { companyName, fullName, dob, nationality, companyAddress, nationIdExpiry } = req.body;
  const docsToUpload = req.files || {};
  const keys = Object.keys(docsToUpload);

  console.log("keys", keys);
  console.log("docsToUpload", docsToUpload);


  const reqField = ["fullName", "companyName", "dob", "nationality", "nationIdExpiry"];
  validateRequestBody(reqField, req.body);

  console.log("req.body", req.body);
  const updateData = {};
  if (companyName) updateData.companyName = companyName;
  if (companyAddress) updateData.companyAddress = companyAddress;
  if (fullName) updateData.fullName = fullName;
  if (dob) updateData.dob = dob;
  if (nationality) updateData.nationality = nationality;
  if (nationIdExpiry) updateData.nationIdExpiry = nationIdExpiry;

  const validDocumentTypes = [
    "national_identity_card_front",
    "national_identity_card_back",
  ];

  const invalidKeys = keys.filter((key) => !validDocumentTypes.includes(key));
  if (invalidKeys.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid document types: ${invalidKeys.join(", ")}`
    );
  }
  const userDocument = await BusOperatorDocumentModel.findOne({ userId });

  let docsIds = [];
  if (Object.keys(docsToUpload).length > 0) {
    for (const key of keys) {
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
  const updatedUser = await BusOperatorModel.findByIdAndUpdate(
    userId,
    updateData,
    {
      new: true,
      runValidators: true,
    }
  ).select("-password");

  if (!updatedUser) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found.");
  }

  if (Object.keys(docsToUpload).length > 0) {
    if (!userDocument) {
      await BusOperatorDocumentModel.create({
        userId,
        documentIds: docsIds,
      });
    } else {
      userDocument.documentIds.push(...docsIds);
      await userDocument.save();
    }
  }
  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        updatedUser,
        "Profile updated successfully."
      )
    );
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






module.exports = {
  registerBusOperator,
  updateBusOperator,
  getAllBusOperators,
  getSingleUser,
  verifyUserProfile,
  deleteBusOperatorAccount,
  searchBusOperators
};

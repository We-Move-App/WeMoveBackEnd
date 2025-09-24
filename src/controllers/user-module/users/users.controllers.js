const {
  DocumentsModel,
} = require("../../../models/global-module/documents/document.model");
const {
  UserBankModel,
} = require("../../../models/user-module/user-banks/user-banks.model");
const RideBookingDetail = require("../../../models/new-driver-module/booking-details/booking-details.model");
const {
  UserDocumentModel,
} = require("../../../models/user-module/user-documents/user-document.model");
const UserModel = require("../../../models/user-module/users/user.model");
const statusCode = require("../../../utils/constants/statusCode");
const {
  validateRequestBody,
} = require("../../../utils/reqFunctions/reqFunction");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const availableModule = require("../../../utils/config/availableModuleConfig.json");
const {
  getUserProfileFunc,
  getAvatarFunc,
  changePasswordFunc,
  setPasswordFieldFunc,
  resetPasswordFunc,
  updateAvatarFunc,
  assignBranchToUserFunc,
  resetPasswordFunc2,
} = require("../../../utils/services/functions.services");
const {
  uploadImageOnAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");
const {
  decodeAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const {
  AdminModel,
} = require("../../../models/admin-module/admin/admin.model");
const { UserAddressModel } = require("../../../models/user-module/user-address/user-address.model");

const getProfile = catchAsyncError(async (req, res, next) => {
  const result = await getUserProfileFunc({
    req,
    res,
    reqModel: UserModel,
    reqDocModel: UserDocumentModel,
    bankModel: UserBankModel,
  });

  const userId = result?.data?.user?._id;
  if (!userId) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  // ✅ fetch address and populate it
  const userAddress = await UserAddressModel.findOne({ userId })
    .populate("address")
    .lean();

  // ✅ attach address inside user
  return res.status(statusCode.OK).json({
    ...result,
    data: {
      user: {
        ...result.data.user,
        address: userAddress?.address || null,
      },
    },
  });
});
const getAvatar = catchAsyncError(async (req, res, next) => {
  const result = await getAvatarFunc({
    req,
    res,
    reqModel: UserModel,
  });

  return res.status(200).json(result);
});

const updateYourProfile = catchAsyncError(async (req, res, next) => {
  const userId = req.user?._id;
  const { fullName, dob, nationality, nationIdExpiry, termAndConditions } =
    req.body;
  const docsToUpload = req.files;

  const keys = Object.keys(req.files);

  const reqField = ["fullName", "dob", "nationality", "nationIdExpiry"];
  validateRequestBody(reqField, req.body);

  const updateData = {};
  if (fullName) updateData.fullName = fullName;

  if (dob) updateData.dob = dob;
  if (nationality) updateData.nationality = nationality;
  if (nationIdExpiry) updateData.nationIdExpiry = nationIdExpiry;
  if (termAndConditions) updateData.termAndConditions = termAndConditions;

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
  // Check for existing documents with the same keys
  const userDocument = await UserDocumentModel.findOne({ userId });

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
      });

      docsIds.push(uploadedDoc._id);
    }
  }
  const updatedUser = await UserModel.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select("-password");

  if (!updatedUser) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found.");
  }

  if (Object.keys(docsToUpload).length > 0) {
    if (!userDocument) {
      await UserDocumentModel.create({
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

const changePassword = catchAsyncError(async (req, res, next) => {
  const result = await changePasswordFunc({
    req,
    res,
    reqModel: UserModel,
  });

  return res.status(statusCode.OK).json(result);
});

const setPassword = catchAsyncError(async (req, res, next) => {
  const result = await setPasswordFieldFunc({
    req,
    res,
    reqModel: UserModel,
  });

  return res.status(statusCode.OK).json(result);
});

const resetPassword = catchAsyncError(async (req, res, next) => {
  const result = await resetPasswordFunc({
    req,
    res,
    reqModel: UserModel,
  });

  return res.status(statusCode.OK).json(result);
});
const resetPassword2 = catchAsyncError(async (req, res, next) => {
  const result = await resetPasswordFunc2({
    req,
    res,
    reqModel: UserModel,
  });

  return res.status(statusCode.OK).json(result);
});

const updateAvatar = catchAsyncError(async (req, res, next) => {
  const result = await updateAvatarFunc({
    req,
    res,
    reqModel: UserModel,
  });

  // 🔹 Take userId from authenticated user
  const userId = req.user?._id;
  if (!userId) {
    return next(
      new ApiError(statusCode.BAD_REQUEST, "User not found after avatar update")
    );
  }

  const user = await UserModel.findById(userId).lean();
  if (!user) {
    return next(new ApiError(statusCode.NOT_FOUND, "User not found"));
  }

  // 🔹 Fetch only SuperAdmins
  const superAdmins = await AdminModel.find({ role: "SuperAdmin" }).lean();

  let recipients = superAdmins.map((sa) => ({
    adminId: sa._id,
    role: sa.role,
    isRead: false,
  }));

  if (recipients.length === 0) {
    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(
          statusCode.OK,
          result,
          "Avatar updated successfully (no SuperAdmin found for notification)"
        )
      );
  }

  await sendNotification({
    recipients,
    type: NotificationTypeEnum.USER_REGISTERED,
    title: "User Registered",
    message: `User Registered (ID: ${userId})`,
    referenceId: userId,
    referenceModel: "User",
    createdBy: userId,
  });

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, result, "Avatar updated successfully")
    );
});

const assignBranch = catchAsyncError(async (req, res, next) => {
  const result = await assignBranchToUserFunc({
    req,
    res,
    reqModel: UserModel,
  });

  return res.status(statusCode.OK).json(result);
});

const mongoose = require("mongoose");
const InactiveUserModel = require("../../../models/user-module/users/inactive-users.model");
const {
  sendNotification,
} = require("../../../socket/handlers/notificationHandler");
const { NotificationTypeEnum } = require("../../../utils/constants/ENUM");

const getBeneficiary = catchAsyncError(async (req, res, next) => {
  const { userId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid QR");
  }

  const user = await UserModel.findById(userId);

  if (!user) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid QR");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { beneficiary: user.fullName },
        "Beneficiary found successfully"
      )
    );
});

const getAvailableModules = catchAsyncError(async (req, res, next) => {
  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { features: availableModule },
        "Available modules"
      )
    );
});

const deleteProfile = catchAsyncError(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token missing or invalid"
    );
  }

  const token = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(token);
  const userId = decoded?._id;

  if (!userId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  await InactiveUserModel.create({
    originalUserId: user._id,
    userId: user.userId,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    dob: user.dob,
    nationality: user.nationality,
    gender: user.gender,
    idNumber: user.idNumber,
    branch: user.branch,
    parentUserId: user.parentUserId,
    deletedAt: new Date(),
    reason: "User requested account deletion",
  });

  await UserModel.findByIdAndDelete(userId);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        null,
        "User deleted and archived successfully"
      )
    );
});

module.exports = {
  getProfile,
  getAvatar,
  updateYourProfile,
  changePassword,
  setPassword,
  resetPassword,
  updateAvatar,
  assignBranch,
  resetPassword2,
  getBeneficiary,
  getAvailableModules,
  deleteProfile,
};

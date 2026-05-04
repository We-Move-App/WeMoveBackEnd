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
const {
  UserAddressModel,
} = require("../../../models/user-module/user-address/user-address.model");
const {
  AddressModel,
} = require("../../../models/global-module/address/address.model");

const getProfile = catchAsyncError(async (req, res, next) => {
  const result = await getUserProfileFunc({
    req,
    res,
    reqModel: UserModel,
    reqDocModel: UserDocumentModel,
    bankModel: UserBankModel,
  });

  const user = result?.data?.user;
  if (!user?._id) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  const userAddress = await UserAddressModel.findOne({ userId: user._id })
    .populate("address")
    .lean();

  const genderTranslations = {
    male: { en: "Male", fr: "Masculin" },
    female: { en: "Female", fr: "Féminin" },
    other: { en: "Other", fr: "Autre" },
  };

  const language = user.ln || "en";
  const translatedGender =
    genderTranslations[user.gender]?.[language] || user.gender;

  return res.status(statusCode.OK).json({
    ...result,
    data: {
      user: {
        ...user,
        gender: translatedGender,
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
  const {
    fullName,
    dob,
    nationality,
    nationIdExpiry,
    termAndConditions,
    gender,

    zoneCode,
    area,
    townCity,
  } = req.body;
  const docsToUpload = req.files;

  const keys = Object.keys(docsToUpload || {});

  const reqField = ["fullName", "dob", "nationality", "nationIdExpiry"];
  validateRequestBody(reqField, req.body);

  // Prepare update data
  const updateData = {};
  if (fullName) updateData.fullName = fullName;
  if (dob) updateData.dob = dob;
  if (gender) updateData.gender = gender;
  if (nationality) updateData.nationality = nationality;
  if (nationIdExpiry) updateData.nationIdExpiry = nationIdExpiry;
  if (termAndConditions) updateData.termAndConditions = termAndConditions;

  // Valid document types
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

  // Fetch existing document record
  const userDocument = await UserDocumentModel.findOne({ userId });

  let docsIds = [];

  // Upload and create new docs if present
  if (keys.length > 0) {
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

  // Update user profile
  const updatedUser = await UserModel.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select("-password");

  if (!updatedUser) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found.");
  }

  // Document update logic
  if (keys.length > 0) {
    if (!userDocument) {
      // If no record exists, create a new one
      await UserDocumentModel.create({
        userId,
        documentIds: docsIds,
      });
    } else {
      // Remove old docs with same type before adding new ones
      const existingDocs = await DocumentsModel.find({
        _id: { $in: userDocument.documentIds },
      });

      const filteredDocs = existingDocs.filter(
        (doc) => !keys.includes(doc.documentType)
      );

      // Keep only filtered (non-replaced) doc IDs
      userDocument.documentIds = filteredDocs.map((doc) => doc._id);

      // Add new uploaded docs
      userDocument.documentIds.push(...docsIds);
      await userDocument.save();
    }
  }
  let updatedAddress = null;
  if (zoneCode && area && townCity) {
    let userAddress = await UserAddressModel.findOne({ userId });

    if (!userAddress) {
      // 🆕 Create new address and link
      const newAddress = await AddressModel.create({
        zoneCode,
        area,
        townCity,
      });

      userAddress = await UserAddressModel.create({
        userId,
        address: newAddress._id,
      });

      updatedAddress = newAddress;
    } else {
      // 📝 Update existing address
      const addressId = userAddress.address?._id;
      let addressToUpdate = await AddressModel.findById(addressId);

      if (!addressToUpdate) {
        throw new ApiError(
          statusCode.NOT_FOUND,
          "Address not found for the provided user."
        );
      }

      addressToUpdate.zoneCode = zoneCode;
      addressToUpdate.area = area;
      addressToUpdate.townCity = townCity;

      await addressToUpdate.save();
      updatedAddress = addressToUpdate;
    }
  }

  // ✅ Send final response
  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        user: updatedUser,
        address: updatedAddress,
      },
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
    title: {
      en: "User Registered",
      fr: "Utilisateur enregistré",
    },
    message: {
      en: `User Registered (ID: ${user.userId})`,
      fr: `Utilisateur enregistré (ID : ${user.userId})`,
    },
    referenceId: user.userId,
    referenceModel: "User",
    createdBy: user.userId,
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
const {
  NotificationTypeEnum,
  LnEnum,
} = require("../../../utils/constants/ENUM");
const { fetchLn } = require("../../../utils/services/user.services");
const { translateLn } = require("../../../utils/services/translator.service");

const getBeneficiary = catchAsyncError(async (req, res, next) => {
  const ln = req.get("ln") || "en";
  const { userId } = req.body;

  const user = await UserModel.findOne({ userId: userId });

  if (!user || user.verificationStatus === "blocked") {
    throw new ApiError(statusCode.BAD_REQUEST, translateLn(ln, "INVALID_QR"));
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { beneficiary: user.fullName },
        translateLn(ln, "BENEFICIARY_FOUND_SUCCESSFULLY")
      )
    );
});

const getAvailableModules = catchAsyncError(async (req, res, next) => {
  const userId = req.user?._id;
  const ln = await fetchLn(userId);

  const features = availableModule.map((module) => ({
    ...module,
    name: translateLn(ln, `MODULE_${module.name.toUpperCase()}`),
  }));

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { features },
        translateLn(ln, "AVAILABLE_MODULES")
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

const changeLanguage = catchAsyncError(async (req, res, next) => {
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

  const { ln } = req.body;
  if (!Object.values(LnEnum).includes(ln)) {
    return res
      .status(statusCode.BAD_REQUEST)
      .json(
        new ApiResponse(statusCode.BAD_REQUEST, null, "Invalid language type")
      );
  }

  user.ln = ln;

  await user.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { ln: user.ln },
        "Language Changed successfully"
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
  changeLanguage,
};

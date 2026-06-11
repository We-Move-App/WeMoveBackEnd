const HotelManagerModel = require("../../../models/hotel-module/hotel-manager/hotel-manager.model");
const {
  HotelManagerDocumentModel,
} = require("../../../models/hotel-module/hotel-manager-documents/hotel-manager-documents.model");
const {
  DocumentsModel,
} = require("../../../models/global-module/documents/document.model");
const {
  HotelManagerBankModel,
} = require("../../../models/hotel-module/hotel-manager-banks/hotel-manager-banks.model");
const statusCode = require("../../../utils/constants/statusCode");
const {
  validateRequestBody,
} = require("../../../utils/reqFunctions/reqFunction");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");

const {
  uploadImageOnAws,
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");
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

/**
 * Get Hotel Manager Profile
 */
const getProfile = catchAsyncError(async (req, res, next) => {
  const result = await getUserProfileFunc({
    req,
    res,
    reqModel: HotelManagerModel,
    reqDocModel: HotelManagerDocumentModel,
    bankModel: HotelManagerBankModel,
  });

  return res.status(statusCode.OK).json(result);
});

/**
 * Get Hotel Manager Avatar
 */
const getAvatar = catchAsyncError(async (req, res, next) => {
  const result = await getAvatarFunc({
    req,
    res,
    reqModel: HotelManagerModel,
  });

  return res.status(statusCode.OK).json(result);
});

/**
 * Update Hotel Manager Profile
 */
const updateYourProfile = catchAsyncError(async (req, res, next) => {
  const userId = req.user?._id;

  if (!userId) {
    return next(new ApiError(statusCode.BAD_REQUEST, "User ID is missing."));
  }

  const { fullName, dob, nationality, nationIdExpiry } = req.body;
  const docsToUpload = req.files;
  const keys = Object.keys(docsToUpload || {});
  // Validate required fields
  validateRequestBody(
    ["fullName", "dob", "nationality", "nationIdExpiry"],
    req.body
  );

  // Prepare update data
  const updateData = {};
  if (fullName) updateData.fullName = fullName;
  if (dob) updateData.dob = dob;
  if (nationality) updateData.nationality = nationality;
  if (nationIdExpiry) updateData.nationIdExpiry = nationIdExpiry;

  // Valid document types
  const validDocumentTypes = [
    "national_identity_card_front",
    "national_identity_card_back",
  ];
  const invalidKeys = keys.filter((key) => !validDocumentTypes.includes(key));

  if (invalidKeys.length > 0) {
    return next(
      new ApiError(
        statusCode.BAD_REQUEST,
        `Invalid document types: ${invalidKeys.join(", ")}`
      )
    );
  }

  // Upload documents if provided
  let docsIds = [];
  if (keys.length > 0) {
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
        ownerId: userId,
      });

      docsIds.push(uploadedDoc._id);
    }
  }

  // Update the hotel manager profile
  const updatedUser = await HotelManagerModel.findByIdAndUpdate(
    userId,
    updateData,
    {
      new: true,
      runValidators: true,
    }
  ).select("-password");

  if (!updatedUser) {
    return next(new ApiError(statusCode.NOT_FOUND, "User not found."));
  }

  // Handle documents storage
  const userDocument = await HotelManagerDocumentModel.findOne({ userId });

  if (keys.length > 0) {
    if (!userDocument) {
      await HotelManagerDocumentModel.create({ userId, documentIds: docsIds });
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

/**
 * Change Password
 */
const changePassword = catchAsyncError(async (req, res, next) => {
  const result = await changePasswordFunc({
    req,
    res,
    reqModel: HotelManagerModel,
  });
  return res.status(statusCode.OK).json(result);
});

/**
 * Set Password
 */
const setPassword = catchAsyncError(async (req, res, next) => {
  const result = await setPasswordFieldFunc({
    req,
    res,
    reqModel: HotelManagerModel,
  });
  return res.status(statusCode.OK).json(result);
});

/**
 * Reset Password
 */
const resetPassword = catchAsyncError(async (req, res, next) => {
  const result = await resetPasswordFunc({
    req,
    res,
    reqModel: HotelManagerModel,
  });
  return res.status(statusCode.OK).json(result);
});

/**
 * Update Avatar
 */
const updateAvatar = catchAsyncError(async (req, res, next) => {
  const result = await updateAvatarFunc({
    req,
    res,
    reqModel: HotelManagerModel,
  });
  return res.status(statusCode.OK).json(result);
});
const assignBranch = catchAsyncError(async (req, res, next) => {
  const result = await assignBranchToUserFunc({
    req,
    res,

    reqModel: HotelManagerModel,
  });

  return res.status(statusCode.OK).json(result);
});
const deleteAccount = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;

  const [user, userBank, userDocs] = await Promise.all([
    HotelManagerModel.findById(_id),
    HotelManagerBankModel.findOne({ userId: _id }),
    HotelManagerDocumentModel.findOne({ userId: _id }).populate("documentIds"),
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
    await HotelManagerDocumentModel.deleteMany({ userId: _id });
  }

  // 🔥 Missing deletions — add these:
  await Promise.all([
    HotelManagerModel.findByIdAndDelete(_id), // Delete user
    hotelManagerBankModel.deleteMany({ userId: _id }), // Delete bank info
  ]);

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, {}, "Deleted Successfully"));
});
const resetPassword2 = catchAsyncError(async (req, res, next) => {
  const result = await resetPasswordFunc2({
    req,
    res,
    reqModel: HotelManagerModel,
  });

  return res.status(statusCode.OK).json(result);
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
  deleteAccount,
  resetPassword2,
};

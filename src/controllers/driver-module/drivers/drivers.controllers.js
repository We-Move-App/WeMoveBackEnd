const {
  DriverDocumentsModel,
} = require("../../../models/driver-module/driver-documents/driver-documents.model");
const DriverModel = require("../../../models/driver-module/drivers/drivers.model");
const {
  DocumentsModel,
} = require("../../../models/global-module/documents/document.model");
const statusCode = require("../../../utils/constants/statusCode");
const {
  validateRequestBody,
} = require("../../../utils/reqFunctions/reqFunction");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");

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

const getProfile = catchAsyncError(async (req, res, next) => {
  const result = await getUserProfileFunc({
    req,
    res,
    reqModel: DriverModel,
    reqDocModel: DriverDocumentsModel,
  });

  return res.status(statusCode.OK).json(result);
});

const getAvatar = catchAsyncError(async (req, res, next) => {
  const result = await getAvatarFunc({
    req,
    res,
    reqModel: DriverModel,
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
    address,
    termAndConditions,
    yearsOfExperience,
  } = req.body;
  const docsToUpload = req.files;
  const keys = Object.keys(req.files);
  const reqField = [
    "fullName",
    "dob",
    "nationality",
    "nationIdExpiry",
    "address",
    "termAndConditions",
    "yearsOfExperience",
  ];
  validateRequestBody(reqField, req.body);

  const updateData = {};
  if (fullName) updateData.fullName = fullName;
  if (dob) updateData.dob = dob;
  if (nationality) updateData.nationality = nationality;
  if (nationIdExpiry) updateData.nationIdExpiry = nationIdExpiry;
  if (address) updateData.address = address;
  if (termAndConditions) updateData.termAndConditions = termAndConditions;
  if (yearsOfExperience) updateData.yearsOfExperience = yearsOfExperience;

  const validDocumentTypes = [
    "national_identity_card_front",
    "national_identity_card_back",
    "driver_license_front",
    "driver_license_back",
  ];

  const invalidKeys = keys.filter((key) => !validDocumentTypes.includes(key));
  if (invalidKeys.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid document types: ${invalidKeys.join(", ")}`
    );
  }
  // Check for existing documents with the same keys
  const userDocument = await DriverDocumentsModel.findOne({ userId });
  let docsIds = [];
  if (keys?.length > 0) {
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
  }
  const updatedUser = await DriverModel.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select("-password");

  if (!updatedUser) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found.");
  }

  if (keys?.length > 0) {
    if (!userDocument) {
      await DriverDocumentsModel.create({
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
    reqModel: DriverModel,
  });

  return res.status(statusCode.OK).json(result);
});

const setPassword = catchAsyncError(async (req, res, next) => {
  const result = await setPasswordFieldFunc({
    req,
    res,
    reqModel: DriverModel,
  });

  return res.status(statusCode.OK).json(result);
});

const resetPassword = catchAsyncError(async (req, res, next) => {
  const result = await resetPasswordFunc({
    req,
    res,
    reqModel: DriverModel,
  });

  return res.status(statusCode.OK).json(result);
});

const resetPassword2 = catchAsyncError(async (req, res, next) => {
  const result = await resetPasswordFunc2({
    req,
    res,
    reqModel: DriverModel,
  });

  return res.status(statusCode.OK).json(result);
});

const updateAvatar = catchAsyncError(async (req, res, next) => {
  const result = await updateAvatarFunc({
    req,
    res,
    reqModel: DriverModel,
  });

  return res.status(statusCode.OK).json(result);
});

const assignBranch = catchAsyncError(async (req, res, next) => {
  const result = await assignBranchToUserFunc({
    req,
    res,
    reqModel: DriverModel,
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
  resetPassword2,
};

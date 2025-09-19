const {
  BusOperatorDocumentModel,
} = require("../../../models/bus-module/bus-operator-documents/bus-operator-document.model");
const BusOperatorModel = require("../../../models/bus-module/bus-operator/bus-operator.model");
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
const {
  BusOperatorBankModel,
} = require("../../../models/bus-module/bus-operator-banks/bus-operator-banks.model");
const {
  sendNotification,
} = require("../../../socket/handlers/notificationHandler");
const { NotificationTypeEnum } = require("../../../utils/constants/ENUM");
const {
  AdminModel,
} = require("../../../models/admin-module/admin/admin.model");

const getProfile = catchAsyncError(async (req, res, next) => {
  const result = await getUserProfileFunc({
    req,
    res,
    reqModel: BusOperatorModel,
    reqDocModel: BusOperatorDocumentModel,
    bankModel: BusOperatorBankModel,
  });

  return res.status(statusCode.OK).json(result);
});

const getAvatar = catchAsyncError(async (req, res, next) => {
  const result = await getAvatarFunc({
    req,
    res,
    reqModel: BusOperatorModel,
  });

  return res.status(200).json(result);
});

const updateYourProfile = catchAsyncError(async (req, res, next) => {
  const userId = req.user?._id;
  const {
    companyName,
    fullName,
    dob,
    nationality,
    companyAddress,
    nationIdExpiry,
  } = req.body;
  const docsToUpload = req.files;

  const keys = Object.keys(req.files);

  const reqField = [
    "fullName",
    "companyName",
    "dob",
    "nationality",
    "nationIdExpiry",
  ];
  validateRequestBody(reqField, req.body);

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
  // Check for existing documents with the same keys
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

const changePassword = catchAsyncError(async (req, res, next) => {
  const result = await changePasswordFunc({
    req,
    res,
    reqModel: BusOperatorModel,
  });

  return res.status(statusCode.OK).json(result);
});

const setPassword = catchAsyncError(async (req, res, next) => {
  const result = await setPasswordFieldFunc({
    req,
    res,
    reqModel: BusOperatorModel,
  });

  return res.status(statusCode.OK).json(result);
});

const resetPassword = catchAsyncError(async (req, res, next) => {
  const result = await resetPasswordFunc({
    req,
    res,
    reqModel: BusOperatorModel,
  });

  return res.status(statusCode.OK).json(result);
});

const resetPassword2 = catchAsyncError(async (req, res, next) => {
  const result = await resetPasswordFunc2({
    req,
    res,
    reqModel: BusOperatorModel,
  });

  return res.status(statusCode.OK).json(result);
});

const updateAvatar = catchAsyncError(async (req, res, next) => {
  const result = await updateAvatarFunc({
    req,
    res,
    reqModel: BusOperatorModel,
  });

  const operatorId = req.user?._id;
  if (!operatorId) {
    return next(
      new ApiError(
        statusCode.BAD_REQUEST,
        "Bus Operator not found after avatar update"
      )
    );
  }

  const operator = await BusOperatorModel.findById(operatorId).lean();
  if (!operator) {
    return next(new ApiError(statusCode.NOT_FOUND, "Bus Operator not found"));
  }

  // 🔹 Fetch SuperAdmins (always included)
  const superAdmins = await AdminModel.find({ role: "SuperAdmin" }).lean();

  // 🔹 Fetch Admins/SubAdmins from same branch with busManagement permission
  const branchAdmins = await AdminModel.find({
    role: { $in: ["Admin", "SubAdmin"] },
    branch: operator.branch,
    "permissions.busManagement": true,
  }).lean();

  // 🔹 Build recipients
  let recipients = [
    ...superAdmins.map((sa) => ({
      adminId: sa._id,
      role: sa.role,
      isRead: false,
    })),
    ...branchAdmins.map((adm) => ({
      adminId: adm._id,
      role: adm.role,
      isRead: false,
    })),
  ];

  if (recipients.length === 0 && superAdmins.length > 0) {
    recipients = [
      { adminId: superAdmins[0]._id, role: "SuperAdmin", isRead: false },
    ];
  }

  // 🔹 Send notification
  await sendNotification({
    recipients,
    type: NotificationTypeEnum.BUS_OPERATOR_REGISTERED,
    title: "Bus Operator Registered",
    message: `Bus Operator Registered (ID: ${operatorId})`,
    referenceId: operatorId,
    referenceModel: "BusOperator",
    createdBy: operatorId,
  });

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, result, "Avatar updated successfully")
    );
});

const deleteAccount = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;

  const [user, userBank, userDocs] = await Promise.all([
    BusOperatorModel.findById(_id),
    BusOperatorBankModel.findOne({ userId: _id }),
    BusOperatorDocumentModel.findOne({ userId: _id }).populate("documentIds"),
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
    await BusOperatorDocumentModel.deleteMany({ userId: _id });
  }

  // 🔥 Missing deletions — add these:
  await Promise.all([
    BusOperatorModel.findByIdAndDelete(_id), // Delete user
    BusOperatorBankModel.deleteMany({ userId: _id }), // Delete bank info
  ]);

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, {}, "Deleted Successfully"));
});

const assignBranch = catchAsyncError(async (req, res, next) => {
  const result = await assignBranchToUserFunc({
    req,
    res,
    reqModel: BusOperatorModel,
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
  deleteAccount,
  assignBranch,
  resetPassword2,
};

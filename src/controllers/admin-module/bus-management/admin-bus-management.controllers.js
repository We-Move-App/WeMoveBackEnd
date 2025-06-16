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
  getAllUsersByAdmin,
  getUserByIdByAdmin,
  userVerifiedByAdmin,
} = require("../../../utils/services/admin.services");
const {
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");

const getAllBusOperators = catchAsyncError(async (req, res, next) => {
  const results = await getAllUsersByAdmin({ req, model: BusOperatorModel });

  return res.status(statusCode.OK).json(results);
});

const getSingleUser = catchAsyncError(async (req, res, next) => {
  const result = await getUserByIdByAdmin({
    req,
    userModel: BusOperatorModel,
    userDocsModel: BusOperatorDocumentModel,
    userBankModel: BusOperatorBankModel,
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


module.exports = {
  getAllBusOperators,
  getSingleUser,
  verifyUserProfile,
  deleteBusOperatorAccount,
};

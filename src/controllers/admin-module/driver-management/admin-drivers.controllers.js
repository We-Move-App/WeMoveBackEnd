const {
  DriverBankModel,
} = require("../../../models/driver-module/driver-banks/driver-banks.model");
const {
  DriverDocumentsModel,
} = require("../../../models/driver-module/driver-documents/driver-documents.model");
const DriverModel = require("../../../models/driver-module/drivers/drivers.model");
const statusCode = require("../../../utils/constants/statusCode");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  getAllUsersByAdmin,
  userVerifiedByAdmin,
  getUserByIdByAdmin,
} = require("../../../utils/services/admin.services");

const getAllDrivers = catchAsyncError(async (req, res, next) => {
  const results = await getAllUsersByAdmin({ req, model: DriverModel });

  return res.status(statusCode.OK).json(results);
});

const getSingleUser = catchAsyncError(async (req, res, next) => {
  const result = await getUserByIdByAdmin({
    req,
    userModel: DriverModel,
    userDocsModel: DriverDocumentsModel,
    userBankModel: DriverBankModel,
  });

  return res.status(statusCode.OK).json(result);
});

const verifyUserProfile = catchAsyncError(async (req, res, next) => {
  const result = await userVerifiedByAdmin({ req, model: DriverModel });

  return res.status(statusCode.OK).json(result);
});

module.exports = {
  getAllDrivers,
  getSingleUser,
  verifyUserProfile,
};

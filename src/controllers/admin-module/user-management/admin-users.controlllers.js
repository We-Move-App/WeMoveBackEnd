const {
  UserBankModel,
} = require("../../../models/user-module/user-banks/user-banks.model");
const {
  UserDocumentModel,
} = require("../../../models/user-module/user-documents/user-document.model");
const UserModel = require("../../../models/user-module/users/user.model");
const statusCode = require("../../../utils/constants/statusCode");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  getUserByIdByAdmin,
  getAllUsersByAdmin,
  userVerifiedByAdmin,
} = require("../../../utils/services/admin.services");

const getAllUsers = catchAsyncError(async (req, res, next) => {
  const results = await getAllUsersByAdmin({ req, model: UserModel });

  return res.status(statusCode.OK).json(results);
});

const getSingleUser = catchAsyncError(async (req, res, next) => {
  const result = await getUserByIdByAdmin({
    req,
    userModel: UserModel,
    userDocsModel: UserDocumentModel,
    userBankModel: UserBankModel,
  });

  return res.status(statusCode.OK).json(result);
});

const verifyUserProfile = catchAsyncError(async (req, res, next) => {
  const result = await userVerifiedByAdmin({ req, model: UserModel });

  return res.status(statusCode.OK).json(result);
});

const deleteUserPermanently = catchAsyncError(async(req,res ,next)=>{
  const {userId} = req.params

  const [user, userBank, userDocs] = await Promise.all([
    UserModel.findById(_id),
    UserBankModel.findOne({ userId: _id }),
    UserDocumentModel.findOne({ userId: _id }).populate("documentIds"),
  ]);


})

module.exports = {
  getAllUsers,
  getSingleUser,
  verifyUserProfile,
};

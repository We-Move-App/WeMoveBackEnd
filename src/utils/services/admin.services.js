const statusCode = require("../constants/statusCode");
const ApiError = require("../response/ApiError");
const ApiResponse = require("../response/ApiResponse");

const getAllUsersByAdmin = async ({ req, model, options }) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const startIndex = (page - 1) * limit;
  const { email, phoneNumber, name } = req.query;

  const query = {
    $or: [],
  };

  if (email) {
    query.$or.push({ email: { $regex: email, $options: "i" } });
  }

  if (phoneNumber) {
    query.$or.push({ phoneNumber });
  }

  if (name) {
    query.$or.push({ fullName: { $regex: name, $options: "i" } });
  }

  const users = await model
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex)
    .select("avatar email phoneNumber fullName verificationStatus");
    
  const totalUser = await model.countDocuments(query).exec();

  const results = {
    users,
    totalPages: Math.ceil(totalUser / limit),
    currentPage: page,
    totalCount: totalUser,
  };

  return new ApiResponse(statusCode.OK, results, `Data found Successfully`);
};

const getUserByIdByAdmin = async ({
  req,
  userModel,
  userDocsModel,
  userBankModel,
}) => {
  const { userId } = req.params;
  const [user, userDocs, userBank] = await Promise.all([
    userModel
      .findOne({ _id: userId })
      .populate("verifiedBy.admin", "userName phoneNumber email"),
    userDocsModel.findOne({ userId }).populate("documentIds"),
    userBankModel.findOne({ userId }),
  ]);

  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  const result = {
    user,
    docs: userDocs,
    bank: userBank,
  };
  return new ApiResponse(statusCode.OK, result, `Data found Successfully`);
};

const userVerifiedByAdmin = async ({ req, model }) => {
  const { status } = req.body;
  const { userId } = req.params;
  if (!userId || !status) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please enter Id in params and status in body"
    );
  }
  const isUser = await model.findOne({ _id: userId });
  if (!isUser) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }
  isUser.verificationStatus = status;

  isUser.verifiedBy = {
    createdAt: new Date().toISOString(),
    admin: req.user._id,
  };

  await isUser.save();

  return new ApiResponse(
    statusCode.OK,
    isUser,
    `User status updated Successfully`
  );
};

const deleteUserPermanentlyByAdmin = async({
  req,
  userModel,
  userDocsModel,
  userBankModel,
}) =>{
  const {userId} = req.params
  

}

module.exports = {
  getAllUsersByAdmin,
  getUserByIdByAdmin,
  userVerifiedByAdmin,
};

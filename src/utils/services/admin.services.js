const statusCode = require("../constants/statusCode");
const ApiError = require("../response/ApiError");
const ApiResponse = require("../response/ApiResponse");
const busModel = require("../../models/bus-module/buses/buses.model");
const { HostAddress } = require("mongodb");



const getAllUsersByAdmin = async ({ req, model }) => {
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    order = "desc",
    search = ""
  } = req.body;

  const skip = (page - 1) * limit;

  const query = {};

  if (search) {
    query.$or = [
      { email: { $regex: search, $options: "i" } },
      { phoneNumber: { $regex: search, $options: "i" } },
      { fullName: { $regex: search, $options: "i" } },
      { verificationStatus: { $regex: search, $options: "i" } }
    ];
  }

  
  const users = await model
    .find(query)
    .sort({ [sortBy]: order === "asc" ? 1 : -1 })
    .limit(limit)
    .skip(skip)
    .select("avatar email phoneNumber fullName verificationStatus");

  // Attach bus count
  const usersWithBusCount = await Promise.all(
    users.map(async (user) => {
      const busCount = await busModel.countDocuments({ ownerId: user._id });
      return {
        ...user.toObject(),
        busCount,
      };
    })
  );

  // Total count
  const totalUser = await model.countDocuments(query).exec();

  return {
    success: true,
    message: "Users fetched successfully",
    total: totalUser,
    page,
    limit,
    sortBy,
    order,
    data: usersWithBusCount,
  };
};



const getUserByIdByAdmin = async ({
  req,
  userModel,
  userDocsModel,
  userBankModel,

}) => {
  const { userId } = req.params;
  const [user, userDocs, userBank,] = await Promise.all([
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
    address: user.address
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

const deleteUserPermanentlyByAdmin = async ({
  req,
  userModel,
  userDocsModel,
  userBankModel,
}) => {
  const { userId } = req.params


}


module.exports = {
  getAllUsersByAdmin,
  getUserByIdByAdmin,
  userVerifiedByAdmin,
};

const statusCode = require("../constants/statusCode");
const ApiError = require("../response/ApiError");
const ApiResponse = require("../response/ApiResponse");
const busModel = require("../../models/bus-module/buses/buses.model");
const { HostAddress } = require("mongodb");




const getAllUsersByAdmin = async ({ req, model }) => {
  let {
    page,
    limit,
    sortBy = "createdAt",
    order = "desc",
    search = ""
  } = req.query;

  page = page ? Math.max(parseInt(page, 10), 1) : 1;
  limit = limit ? Math.max(parseInt(limit, 10), 1) : 10;

  const skip = (page - 1) * limit;

  const query = {};
  if (search && search.trim() !== "") {
    const regex = new RegExp(search, "i");
    query.$or = [
      { email: regex },
      { phoneNumber: regex },
      { fullName: regex },
      { companyName, regex },
      { verificationStatus: regex }
    ];
  }

  const totalUser = await model.countDocuments(query);

  if (skip >= totalUser && totalUser > 0) {
    return {
      success: true,
      message: "No users found on this page",
      total: totalUser,
      page,
      limit,
      sortBy,
      order,
      data: [],
    };
  }

  const user = await model
    .find(query)
    .sort({ [sortBy]: order.toLowerCase() === "asc" ? 1 : -1 })
    .skip(skip)
    .limit(limit)
    .select("avatar email phoneNumber fullName verificationStatus");

  return {
    success: true,
    message: "Users fetched successfully",
    total: totalUser,
    page,
    limit,
    sortBy,
    order,
    data: user,
  };
};

const getUserByIdByAdmin = async ({
  req,
  userModel,
  userDocsModel,
  userBankModel,

}) => {
  const { userId } = req.params;
  console.log("userId", userId);

  const [user, userDocs, userBank] = await Promise.all([
    userModel
      .findOne({ _id: userId })
      .populate("verifiedBy.admin", "userName phoneNumber email")
      .populate("branch", "name location"), //
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

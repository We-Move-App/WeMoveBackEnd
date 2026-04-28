const statusCode = require("../constants/statusCode");
const ApiError = require("../response/ApiError");
const ApiResponse = require("../response/ApiResponse");
const busModel = require("../../models/bus-module/buses/buses.model");
const { HostAddress } = require("mongodb");
const { translateLn } = require("../../utils/services/translator.service");

const getAllUsersByAdmin = async ({ req, model }) => {
  let {
    page,
    limit,
    sortBy = "createdAt",
    order = "desc",
    search = "",
    verificationStatus,
  } = req.query;

  page = page ? Math.max(parseInt(page, 10), 1) : 1;
  limit = limit ? Math.max(parseInt(limit, 10), 1) : 10;

  const skip = (page - 1) * limit;

  const allowedStatuses = [
    "submitted",
    "processing",
    "pending",
    "approved",
    "rejected",
    "blocked",
  ];
  if (verificationStatus && !allowedStatuses.includes(verificationStatus)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid verificationStatus. Allowed values are: ${allowedStatuses.join(", ")}`
    );
  }

  const query = {};

  if (req.user.role !== "SuperAdmin") {
    query.branch = req.user.branch;
  }

  if (search && search.trim() !== "") {
    const regex = new RegExp(search, "i");
    query.$or = [
      { email: regex },
      { phoneNumber: regex },
      { fullName: regex },
      { companyName: regex },
      // { verificationStatus: regex },
    ];
  }

  if (verificationStatus && verificationStatus.trim() !== "") {
    const statuses = verificationStatus
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => allowedStatuses.includes(s)); // ✅ only valid values

    if (statuses.length > 0) {
      query.verificationStatus = { $in: statuses };
    }
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
    .select(
      "avatar email phoneNumber fullName verificationStatus branchId batchVerified"
    )
    .populate([
      { path: "verifiedBy", select: "userName email" },
      { path: "batchVerifiedBy", select: "userName email" },
    ]);

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
  const ln = (req.headers["ln"] || "en").toLowerCase();

  const [user, userDocs, userBank] = await Promise.all([
    userModel
      .findOne({ _id: userId })
      .populate("verifiedBy.admin", "userName phoneNumber email")
      .populate("branch", "name location"),

    userDocsModel.findOne({ userId }).populate("documentIds"),
    userBankModel.findOne({ userId }),
  ]);

  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, translateLn(ln, "USER_NOT_FOUND"));
  }

  const result = {
    user: {
      ...user.toObject(),
      verificationStatus: user.verificationStatus,
    },
    docs: userDocs,
    bank: userBank,
    address: user.address,
  };

  return new ApiResponse(
    statusCode.OK,
    result,
    translateLn(ln, "DATA_FOUND_SUCCESS")
  );
};

const userVerifiedByAdmin = async ({ req, model }) => {
  const { status, remarks, batchVerified } = req.body;
  const ln = (req.headers["ln"] || "en").toLowerCase();

  const { userId } = req.params;

  if (!userId || !status) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "PLEASE_ENTER_ID_AND_STATUS")
    );
  }

  if (
    status.toLowerCase() === "blocked" &&
    (!remarks || remarks.trim() === "")
  ) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "REMARKS_REQUIRED_FOR_BLOCK")
    );
  }

  const isUser = await model.findOne({ _id: userId });
  if (!isUser) {
    throw new ApiError(statusCode.NOT_FOUND, translateLn(ln, "USER_NOT_FOUND"));
  }
  isUser.verificationStatus = status;

  isUser.verifiedBy = req.user._id;

  if (remarks) {
    isUser.remarks = remarks.trim();
  } else {
    // Optional: clear previous remarks if status is not blocked
    isUser.remarks = "";
  }

  // ✅ Handle batch verification independently
  if (typeof batchVerified === "boolean") {
    isUser.batchVerified = batchVerified;

    if (batchVerified) {
      // Set admin and date when batch verified
      isUser.batchVerifiedBy = req.user._id;
    } else {
      // Reset if turned off
      isUser.batchVerifiedBy = null;
    }
  }

  await isUser.save();

  return new ApiResponse(
    statusCode.OK,

    translateLn(ln, "USER_STATUS_UPDATED_SUCCESSFULLY")
  );
};

const deleteUserPermanentlyByAdmin = async ({
  req,
  userModel,
  userDocsModel,
  userBankModel,
}) => {
  const { userId } = req.params;
};

module.exports = {
  getAllUsersByAdmin,
  getUserByIdByAdmin,
  userVerifiedByAdmin,
};

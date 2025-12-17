const mongoose = require("mongoose");
const ApiError = require("../../../utils/response/ApiError");

const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const statusCode = require("../../../utils/constants/statusCode");
const {
  validateRequestBody,
} = require("../../../utils/reqFunctions/reqFunction");
const UserModel = require("../../../models/user-module/users/user.model");
const generateCustomId = require("../../../utils/customId/generateCustomId");
const { EntityCodeEnum } = require("../../../utils/constants/ENUM");
const {
  generateTokens,

  refreshAccessToken,
  saveRefreshToken,
  setTokenCookies,
} = require("../../../utils/jwtToken/generateTokens");
const {
  decodeAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const { v4: uuidv4 } = require("uuid");
const Transaction = require("../../../models/transaction-module/transaction.model");
const walletModel = require("../../../models/wallet-module/wallets.model");
const {
  sendOtpToPhone,
  sendOtpToEmail,
  verifyEmailOtp,
  verifyPhoneOtp,
} = require("../../../utils/otpService/otpService");
const BlackListTokenModel = require("../../../models/global-module/blacklist-tokens/blacklist-token.model");
const emailVerifyModel = require("../../../models/global-module/verifications/emailVerification.model");
const phoneNumberVerifyModel = require("../../../models/global-module/verifications/phoneNumberVerification");
const {
  validateEmail,
  validatePhoneNumber,
} = require("../../../utils/validation/forSchema");

const addMemberUnderUser = catchAsyncError(async (req, res, next) => {
  const { name, email, password, confirmPassword, accessForView } = req.body;
  const { _id: parentId } = req.user;

  // ✅ Validate required fields
  const requiredFields = ["name", "email", "password", "confirmPassword"];
  validateRequestBody(requiredFields, req.body);

  if (password !== confirmPassword) {
    throw new ApiError(statusCode.BAD_REQUEST, "Passwords do not match");
  }
  const existingUser = await UserModel.findOne({ email });
  if (existingUser) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "User already exists with this email"
    );
  }
  const parentUser = await UserModel.findById(parentId);
  if (!parentUser) {
    throw new ApiError(statusCode.NOT_FOUND, "Parent user not found");
  }
  if (parentUser.role === "user-member") {
    throw new ApiError(
      statusCode.FORBIDDEN,
      "User-members are not allowed to add members"
    );
  }
  const existingMembersCount = await UserModel.countDocuments({
    parentUserId: parentId,
    role: "user-member",
  });
  if (existingMembersCount >= 5) {
    throw new ApiError(
      statusCode.FORBIDDEN,
      "You can add a maximum of 5 user-members only"
    );
  }

  // ✅ Generate custom member ID
  const memberId = await generateCustomId(EntityCodeEnum.USER_MEMBER, "UM");
  const newMember = new UserModel({
    userId: memberId,
    fullName: name,
    email,
    password,
    role: "user-member",
    parentUserId: parentId,
    branch: parentUser.branch, // 👈 assign same branch
    createdBy: parentId,
    verificationStatus: "approved", // ✅ Approved immediately
    emailVerified: true, // ✅ Email verified
    phoneVerified: true, // ✅ Phone verified
    termAndConditions: true,
    accessForView: accessForView ?? false,
  });

  const savedMember = await newMember.save();

  // ✅ Populate parent info for response
  await savedMember.populate({
    path: "parentUserId",
    select: "fullName email role branch",
  });

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        { member: savedMember },
        "Member added successfully under same branch"
      )
    );
});
const loginUser = catchAsyncError(async (req, res, next) => {
  const { emailOrPhone, password } = req.body;
  console.log(emailOrPhone, password);

  // Step 1: Validate inputs
  if (!emailOrPhone) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter email or phone");
  }

  const isEmail = validateEmail(emailOrPhone);
  const isPhoneNumber = validatePhoneNumber(emailOrPhone);

  if (!isEmail && !isPhoneNumber) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Enter a valid email or phone number"
    );
  }

  if (!password) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please enter password");
  }

  // Step 2: Find user
  const existingUser = await UserModel.findOne({
    $or: [{ email: emailOrPhone }, { phoneNumber: emailOrPhone }],
  }).select("+password");

  if (!existingUser) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  if (!existingUser.password) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "You registered with OTP. Please reset your password"
    );
  }

  // Step 3: Verify password
  const isPasswordMatch = await existingUser.comparePassword(password);
  if (!isPasswordMatch) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid credentials");
  }

  // Step 4: Verify user status
  if (!["approved"].includes(existingUser.verificationStatus)) {
    throw new ApiError(
      statusCode.FORBIDDEN,
      getStatusMessage(existingUser.verificationStatus)
    );
  }

  if (["blocked", "rejected"].includes(existingUser.verificationStatus)) {
    throw new ApiError(
      statusCode.FORBIDDEN,
      getStatusMessage(existingUser.verificationStatus)
    );
  }

  // Step 5: Generate JWT tokens
  const { accessToken, refreshToken } = await generateTokens(existingUser);

  // Step 6: Set cookies for session management
  setTokenCookies(res, accessToken, refreshToken);

  // Step 7: Prepare response data
  const responseData = {
    token: accessToken,
    refreshToken,
    user: {
      userId: existingUser.userId,
      fullName: existingUser.fullName,
      email: existingUser.email,
      role: existingUser.role,
    },
  };

  // Step 8: Send response
  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, responseData, "Login successfully"));
});
const getAllMembersUnderUser = catchAsyncError(async (req, res, next) => {
  const { _id: parentId } = req.user;
  console.log("req.user =>", req.user);

  const { search = "" } = req.query;

  // ✅ Check parent user existence
  const parentUser = await UserModel.findById(parentId);
  if (!parentUser) {
    throw new ApiError(statusCode.NOT_FOUND, "Parent user not found");
  }

  // ✅ Restrict user-members from accessing this
  if (parentUser.role === "user-member") {
    throw new ApiError(
      statusCode.FORBIDDEN,
      "User-members are not allowed to view member list"
    );
  }

  // ✅ Build search filter
  const searchFilter = search
    ? {
        $or: [
          { userId: { $regex: search, $options: "i" } },
          { fullName: { $regex: search, $options: "i" } },
        ],
      }
    : {};

  // ✅ Final filter (must match this parent)
  const filter = {
    parentUserId: new mongoose.Types.ObjectId(parentId),
    role: "user-member",
    ...searchFilter,
  };

  // ✅ Query
  const members = await UserModel.find(filter)
    .select(
      "userId fullName email role verificationStatus accessForView createdAt"
    )
    .sort({ createdAt: -1 });

  // ✅ Handle empty results gracefully
  if (!members || members.length === 0) {
    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(
          statusCode.OK,
          { count: 0, members: [] },
          "No user-members found for this parent user"
        )
      );
  }

  // ✅ Success response
  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { count: members.length, members },
        "All user-members fetched successfully"
      )
    );
});
const deleteMemberByUserId = catchAsyncError(async (req, res, next) => {
  const { _id: parentId } = req.user; // Parent user ID from token
  const { userId } = req.params; // userId from URL

  // Validate parent user
  const parentUser = await UserModel.findById(parentId);
  if (!parentUser) {
    throw new ApiError(statusCode.NOT_FOUND, "Parent user not found");
  }

  // Restrict user-members from deleting
  if (parentUser.role === "user-member") {
    throw new ApiError(
      statusCode.FORBIDDEN,
      "User-members are not allowed to delete members"
    );
  }

  // Find member under this parent
  const member = await UserModel.findOne({
    userId: userId,
    parentUserId: parentId,
    role: "user-member",
  });

  if (!member) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "No user-member found with this userId under your account"
    );
  }

  // Delete permanently
  await UserModel.deleteOne({ _id: member._id });

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        {},
        `Member (${member.fullName}) deleted successfully`
      )
    );
});
const getUserProfile = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user; // Get user ID from JWT

  // Fetch user from DB, exclude password
  const user = await UserModel.findById(_id)
    .select("-password")
    .populate("branch", "-createdAt -updatedAt -__v")
    .populate("parentUserId", "fullName email role branch")
    .lean();

  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, { user }, "Profile found"));
});

const getTransactions = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const jwtToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(jwtToken);

  const {
    page: pageQuery,
    limit: limitQuery,
    sortBy = "date", // 'date' or 'amount'
    order = "desc", // 'asc' or 'desc'
    search, // 🔍 search by transactionId or amount
  } = req.query;

  const userId = decoded?._id;
  if (!userId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  // Pagination
  const page = Math.max(parseInt(pageQuery) || 1, 1);
  const limit = Math.min(Math.max(parseInt(limitQuery) || 10, 1), 100);

  // Find logged-in user
  const user = await UserModel.findById(userId).lean();
  if (!user) throw new ApiError(statusCode.NOT_FOUND, "User not found");

  // Get target user
  const targetUserId =
    user.role === "user-member" ? user.parentUserId : user._id;

  if (!targetUserId) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Parent user ID not found for this member"
    );
  }

  // Find parent user
  const parentUser = await UserModel.findById(targetUserId)
    .select("fullName email")
    .lean();

  if (!parentUser) {
    throw new ApiError(statusCode.NOT_FOUND, "Parent user not found");
  }

  // Base transaction filter
  const txFilter = {
    userId: targetUserId,
    description: { $regex: /^Received from /i },
  };

  // 🔍 Search filter
  if (search) {
    const searchConditions = [];

    // transactionId (partial, case-insensitive)
    searchConditions.push({
      transactionId: { $regex: search, $options: "i" },
    });

    // amount (exact match if numeric)
    if (!isNaN(search)) {
      searchConditions.push({ amount: Number(search) });
    }

    txFilter.$or = searchConditions;
  }

  // Sorting
  const sortField = sortBy === "amount" ? "amount" : "createdAt";
  const sortOrder = order === "asc" ? 1 : -1;

  // Total count
  const totalCount = await Transaction.countDocuments(txFilter);

  // Fetch transactions
  const transactions = await Transaction.find(txFilter)
    .sort({ [sortField]: sortOrder })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // Format response
  const formattedTransactions = transactions.map((tx) => ({
    transactionId: tx.transactionId?.substring(0, 8) || "N/A",
    userName: parentUser.fullName,
    email: parentUser.email,
    amount: tx.amount,
    description: tx.description,
    status: tx.status,
    date: tx.createdAt?.toISOString().split("T")[0],
    time: tx.createdAt?.toISOString().split("T")[1].split(".")[0],
  }));

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        transactions: formattedTransactions,
        pagination: {
          total: totalCount,
          page,
          pages: Math.ceil(totalCount / limit),
          limit,
        },
      },
      "Transactions fetched successfully"
    )
  );
});

const updateMemberUnderUser = catchAsyncError(async (req, res, next) => {
  const { memberId } = req.params; // ✅ pass memberId in URL
  const { name, email, password, confirmPassword } = req.body;
  const { _id: parentId } = req.user;

  // ✅ Check member existence
  const member = await UserModel.findOne({
    _id: memberId,
    parentUserId: parentId, // only allow parent to update their members
    role: "user-member",
  });

  if (!member) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "Member not found or not under your account"
    );
  }

  // ✅ Validate password fields if provided
  if ((password && !confirmPassword) || (!password && confirmPassword)) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Both password and confirmPassword are required"
    );
  }

  if (password && confirmPassword && password !== confirmPassword) {
    throw new ApiError(statusCode.BAD_REQUEST, "Passwords do not match");
  }

  // ✅ If email is updated, check duplication
  if (email && email !== member.email) {
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      throw new ApiError(statusCode.BAD_REQUEST, "Email already exists");
    }
    member.email = email;
  }

  // ✅ Update name if provided
  if (name) member.fullName = name;

  // ✅ Update password (hashed automatically if you have pre-save hook)
  if (password && confirmPassword) member.password = password;

  await member.save();

  // ✅ Populate parent info for response
  await member.populate({
    path: "parentUserId",
    select: "fullName email role branch",
  });

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { member },
        "Member details updated successfully"
      )
    );
});

module.exports = {
  addMemberUnderUser,
  updateMemberUnderUser,
  loginUser,
  getAllMembersUnderUser,
  deleteMemberByUserId,
  getUserProfile,
  getTransactions,
};

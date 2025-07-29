const statusCode = require("../../utils/constants/statusCode");
const {
  decodeAccessToken,
} = require("../../utils/jwtToken/customTokenService");
const { v4: uuidv4 } = require("uuid");
const Transaction = require("../../models/transaction-module/transaction.model");
const Wallet = require("../../models/wallet-module/wallets.model");
const ApiError = require("../../utils/response/ApiError");
const catchAsyncError = require("../../utils/response/catchAsyncError");
const { walletValidation } = require("./wallet.validation");
const UserModel = require("../../models/user-module/users/user.model");
const {
  TransactionTypeEnum,
  PaymentStatusEnum,
} = require("../../utils/constants/ENUM");
const ApiResponse = require("../../utils/response/ApiResponse");
const SecurePinModel = require("../../models/global-module/secure-pins/secure-pins.model");
const BusOperatorModel = require("../../models/bus-module/bus-operator/bus-operator.model");
const HotelManagerModel = require("../../models/hotel-module/hotel-manager/hotel-manager.model");
const DriverDetails = require("../../models/new-driver-module/basic-details/basic-details.model");

const deductfromUserWallet = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const jwtToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(jwtToken);
  const userId = decoded?._id;

  if (!userId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const userExists = await UserModel.findById(userId);
  if (!userExists) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  const { error, value } = walletValidation.validate(req.body);
  if (error) {
    throw new ApiError(statusCode.BAD_REQUEST, error.details[0].message);
  }

  const { amount, currency, description } = value;

  const userWallet = await Wallet.findOne({ userId });
  if (!userWallet) {
    throw new ApiError(statusCode.NOT_FOUND, "Wallet not found / Do topup");
  }

  if (userWallet.balance < amount) {
    throw new ApiError(statusCode.BAD_REQUEST, "Insufficient wallet balance");
  }

  userWallet.balance -= amount;
  await userWallet.save();

  const transaction = await Transaction.create({
    userId,
    transactionId: uuidv4(),
    type: TransactionTypeEnum.DEBIT,
    amount,
    currency: currency || userWallet.currency,
    description: description || "Wallet deduction",
    status: PaymentStatusEnum.SUCCESS,
  });

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        balance: userWallet.balance,
        transactionId: transaction.transactionId,
      },
      "Amount deducted successfully"
    )
  );
});

const refundToUserWallet = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const jwtToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(jwtToken);
  const userId = decoded?._id;

  if (!userId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const userExists = await UserModel.findById(userId);
  if (!userExists) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  const { error, value } = walletValidation.validate(req.body);
  if (error) {
    throw new ApiError(statusCode.BAD_REQUEST, error.details[0].message);
  }

  const { amount, currency, description } = value;

  const userWallet = await Wallet.findOne({ userId });
  if (!userWallet) {
    throw new ApiError(statusCode.NOT_FOUND, "Wallet not found");
  }

  userWallet.balance += amount;
  await userWallet.save();

  const transaction = await Transaction.create({
    userId,
    transactionId: uuidv4(),
    type: TransactionTypeEnum.CREDIT,
    amount,
    currency: currency || userWallet.currency,
    description: description || "Wallet refund",
    status: PaymentStatusEnum.SUCCESS,
  });

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        balance: userWallet.balance,
        transactionId: transaction.transactionId,
      },
      "Amount refunded successfully"
    )
  );
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
  const userId = decoded?._id;

  if (!userId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const { entity } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1); 
  const limit = 10; 

  let Model;
  let txFilter = {};

  switch (entity) {
    case "busoperator":
      Model = BusOperatorModel;
      break;
    case "hotelManager":
      Model = HotelManagerModel;
      break;
    case "driver":
      Model = DriverDetails;
      break;
    default:
      Model = UserModel;
  }

  const entityExists = await Model.findById(userId);
  if (!entityExists) {
    throw new ApiError(statusCode.NOT_FOUND, `${entity || "User"} not found`);
  }

  if (entity === "driver") {
    txFilter.driverId = entityExists.driverId;
  } else if (entity === "busoperator") {
    txFilter.busOperatorId = entityExists._id;
  } else if (entity === "hotelManager") {
    txFilter.hotelManagerId = entityExists._id;
  } else {
    txFilter.userId = userId;
  }

  // Pagination
  const transactions = await Transaction.find(txFilter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const totalCount = await Transaction.countDocuments(txFilter);

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        transactions,
        pagination: {
          total: totalCount,
          page,
          pages: Math.ceil(totalCount / limit),
        },
      },
      "Transactions fetched successfully"
    )
  );
});

const getAnalytics = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const jwtToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(jwtToken);
  const userId = decoded?._id;

  if (!userId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const { entity, filter = "yearly" } = req.query;
  let Model;
  let txFilter = {};

  switch (entity) {
    case "busoperator":
      Model = BusOperatorModel;
      break;
    case "hotelManager":
      Model = HotelManagerModel;
      break;
    // case "driver":
    //   Model = DriverDetails;
    //   break;
    default:
      Model = UserModel;
  }

  const entityExists = await Model.findById(userId);
  if (!entityExists) {
    throw new ApiError(statusCode.NOT_FOUND, `${entity || "User"} not found`);
  }

  if (entity === "busoperator") {
    txFilter.busOperatorId = entityExists._id;
  }else if (entity === "hotelManager") {
    txFilter.hotelManagerId = entityExists._id;
  } else {
    txFilter.userId = userId;
  }

  const now = new Date();
  let analytics = [];

  if (filter === "monthly") {
    // restrict to current year
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

    txFilter.createdAt = { $gte: yearStart, $lte: yearEnd };

    analytics = await Transaction.aggregate([
      { $match: txFilter },
      {
        $group: {
          _id: { month: { $month: "$createdAt" } },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.month": 1 } },
    ]);

    const months = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];

    analytics = months.map((m, i) => {
      const monthData = analytics.find((a) => a._id.month === i + 1);
      return {
        month: m,
        totalAmount: monthData ? monthData.totalAmount : 0,
      };
    });

  } else {
    // yearly analytics (all years)
    analytics = await Transaction.aggregate([
      { $match: txFilter },
      {
        $group: {
          _id: { year: { $year: "$createdAt" } },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1 } },
    ]);

    analytics = analytics.map((a) => ({
      year: a._id.year,
      totalAmount: a.totalAmount,
    }));
  }

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        entity,
        filter,
        analytics,
      },
      `${filter.charAt(0).toUpperCase() + filter.slice(1)} analytics fetched successfully`
    )
  );
});

const getWallet = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const jwtToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(jwtToken);
  const userId = decoded?._id;

  if (!userId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  // const userExists = await UserModel.findById(userId);
  // if (!userExists) {
  //   throw new ApiError(statusCode.NOT_FOUND, "User not found");
  // }

  const wallet = await Wallet.findOne({ userId: userId });
  if (!wallet) {
    throw new ApiError(statusCode.NOT_FOUND, "Wallet not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, wallet, "wallet fetched successfully")
    );
});

const validatePin = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const jwtToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(jwtToken);
  const userId = decoded?._id;

  if (!userId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const userExists = await UserModel.findById(userId);
  if (!userExists) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  const { pin } = req.body;
  if (!pin) {
    throw new ApiError(statusCode.BAD_REQUEST, "PIN is required");
  }

  const securePinRecord = await SecurePinModel.findOne({ userId });
  if (!securePinRecord) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "Secure PIN not set for this user"
    );
  }

  const isValid = await securePinRecord.verifyPin(pin);
  if (!isValid) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid PIN");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { isValid: true },
        "PIN verified successfully"
      )
    );
});

module.exports = {
  deductfromUserWallet,
  refundToUserWallet,
  getTransactions,
  getWallet,
  validatePin,
  getAnalytics
};

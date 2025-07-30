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

  const { entity, filter = "monthly" } = req.query;
  let Model;
  let txFilter = {};

  switch (entity) {
    case "busoperator":
      Model = BusOperatorModel;
      break;
    case "hotelManager":
      Model = HotelManagerModel;
      break;
    default:
      Model = UserModel;
  }

  const entityExists = await Model.findById(userId);
  if (!entityExists) {
    throw new ApiError(statusCode.NOT_FOUND, `${entity || "User"} not found`);
  }

  if (entity === "busoperator") {
    txFilter.busOperatorId = String(entityExists._id);
  } else if (entity === "hotelManager") {
    txFilter.hotelManagerId = String(entityExists._id);
  } else {
    txFilter.userId = String(userId);
  }

  const now = new Date();
  let analytics = [];

  // Helper for grouping
  const groupStage = (idObj) => ({
    _id: idObj,
    incoming: {
      $sum: { $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", 0] }
    },
    refunded: {
      $sum: { $cond: [{ $and: [{ $eq: ["$type", "DEBIT"] }, { $eq: ["$refund", true] }] }, "$amount", 0] }
    },
    withdraw: {
      $sum: { $cond: [{ $and: [{ $eq: ["$type", "DEBIT"] }, { $eq: ["$withdraw", true] }] }, "$amount", 0] }
    }
  });

  if (filter === "daily") {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    txFilter.createdAt = { $gte: startOfDay, $lte: endOfDay };

    const result = await Transaction.aggregate([
      { $match: txFilter },
      { $group: groupStage(null) }
    ]);

    const data = result[0] || { incoming: 0, refunded: 0, withdraw: 0 };
    analytics = [{
      date: startOfDay.toISOString().split("T")[0],
      incoming: data.incoming,
      refunded: data.refunded,
      withdraw: data.withdraw,
      profit: data.incoming - data.refunded // withdraw not subtracted
    }];

  } else if (filter === "weekly") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    txFilter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };

    const results = await Transaction.aggregate([
      { $match: txFilter },
      { $group: { ...groupStage({ week: { $ceil: { $divide: [{ $dayOfMonth: "$createdAt" }, 7] } } }) } },
      { $sort: { "_id.week": 1 } }
    ]);

    const totalWeeks = Math.ceil(endOfMonth.getDate() / 7);
    analytics = Array.from({ length: totalWeeks }, (_, i) => {
      const week = i + 1;
      const weekData = results.find((a) => a._id.week === week);
      return {
        week: `Week ${week}`,
        incoming: weekData ? weekData.incoming : 0,
        refunded: weekData ? weekData.refunded : 0,
        withdraw: weekData ? weekData.withdraw : 0,
        profit: weekData ? (weekData.incoming - weekData.refunded) : 0
      };
    });

  } else if (filter === "monthly") {
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    txFilter.createdAt = { $gte: yearStart, $lte: yearEnd };

    const results = await Transaction.aggregate([
      { $match: txFilter },
      { $group: { ...groupStage({ month: { $month: "$createdAt" }, year: { $year: "$createdAt" } }) } },
      { $sort: { "_id.month": 1 } }
    ]);

    const months = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];

    analytics = months.map((m, i) => {
      const monthData = results.find(
        (a) => a._id.month === i + 1 && a._id.year === now.getFullYear()
      );
      return {
        month: m,
        incoming: monthData ? monthData.incoming : 0,
        refunded: monthData ? monthData.refunded : 0,
        withdraw: monthData ? monthData.withdraw : 0,
        profit: monthData ? (monthData.incoming - monthData.refunded) : 0
      };
    });

  } else if (filter === "yearly") {
    const startYear = now.getFullYear() - 9;
    const startDate = new Date(startYear, 0, 1);
    txFilter.createdAt = { $gte: startDate, $lte: now };

    const results = await Transaction.aggregate([
      { $match: txFilter },
      { $group: { ...groupStage({ year: { $year: "$createdAt" } }) } },
      { $sort: { "_id.year": 1 } }
    ]);

    analytics = Array.from({ length: 10 }, (_, i) => {
      const year = startYear + i;
      const yearData = results.find((a) => a._id.year === year);
      return {
        year,
        incoming: yearData ? yearData.incoming : 0,
        refunded: yearData ? yearData.refunded : 0,
        withdraw: yearData ? yearData.withdraw : 0,
        profit: yearData ? (yearData.incoming - yearData.refunded) : 0
      };
    });
  }

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      { entity, filter, analytics },
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

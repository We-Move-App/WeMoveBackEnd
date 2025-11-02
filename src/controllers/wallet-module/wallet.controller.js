const mongoose = require("mongoose");
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
const { AdminModel } = require("../../models/admin-module/admin/admin.model");
const {
  generateTransactionPDFBase64,
} = require("../../utils/services/invoice.service");
const Commission = require("../../models/admin-module/commission-management/commission.model");

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

const userInternalTransaction = catchAsyncError(async (req, res) => {
  // ---- Auth ----
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }
  const jwtToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(jwtToken);

  const senderId = decoded?.userId; // <- keep this consistent
  if (!senderId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  // ---- Inputs ----
  const { userId: receiverId, amount } = req.body;
  if (!receiverId || !amount || Number(amount) <= 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid receiver or amount");
  }
  if (String(senderId) === String(receiverId)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Cannot send to yourself");
  }

  // ---- Basic validations ----
  const [sender, receiver] = await Promise.all([
    UserModel.findOne({ userId: senderId }),
    UserModel.findOne({ userId: receiverId }),
  ]);
  if (!sender) throw new ApiError(statusCode.NOT_FOUND, "Sender not found");
  if (!receiver) throw new ApiError(statusCode.NOT_FOUND, "Receiver not found");

  // ---- Commission: find active rule for "user" transfers ----
  // NOTE: start a session BEFORE using .session(session)
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const commission = await Commission.findOne({
      serviceType: "user",
      status: "active",
    }).session(session);

    // Compute commission amount
    const amt = Number(amount);
    let platformFee = 0;

    if (commission) {
      if (
        commission.commissionType === "percentage" &&
        commission.commissionPercentage != null
      ) {
        platformFee = Number(
          ((amt * Number(commission.commissionPercentage)) / 100).toFixed(2)
        );
      } else if (
        commission.commissionType === "fixed" &&
        commission.commissionRate != null
      ) {
        platformFee = Number(Number(commission.commissionRate).toFixed(2));
      }
    }

    const totalDebit = Number((amt + platformFee).toFixed(2)); // what the sender must have & pay

    // ---- Load wallets (lock by reading inside txn) ----
    const [senderWallet, receiverWallet] = await Promise.all([
      Wallet.findOne({ userId: sender._id }).session(session),
      Wallet.findOne({ userId: receiver._id }).session(session),
    ]);

    if (!senderWallet)
      throw new ApiError(statusCode.NOT_FOUND, "Sender wallet not found");
    if (!receiverWallet)
      throw new ApiError(statusCode.NOT_FOUND, "Receiver wallet not found");

    // Optional: enforce same currency; otherwise handle conversion here
    const currency = senderWallet.currency || process.env.MOMO_CURRENCY;

    // ---- Sufficient balance? ----
    if (Number(senderWallet.balance) < totalDebit) {
      throw new ApiError(statusCode.BAD_REQUEST, "Insufficient balance");
    }

    // ---- Find admin for fee credit ----
    const superAdmin = await AdminModel.findOne({ role: "SuperAdmin" }).session(
      session
    );
    const adminId = superAdmin?._id || "ADM001";

    // ---- Apply atomic wallet updates ----
    // Deduct totalDebit from sender
    await Wallet.findOneAndUpdate(
      { _id: senderWallet._id },
      { $inc: { balance: -totalDebit } },
      { session, new: true }
    );

    // Credit receiver with transfer amount
    await Wallet.findOneAndUpdate(
      { _id: receiverWallet._id },
      { $inc: { balance: amt } },
      { session, new: true }
    );

    // Credit admin with platform fee (if any)
    if (platformFee > 0) {
      await Wallet.findOneAndUpdate(
        { userId: adminId },
        { $inc: { balance: platformFee } },
        { session, new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    // ---- Create transactions (3 rows) ----
    const baseMeta = {
      status: PaymentStatusEnum.SUCCESS,
      currency,
    };

    const senderTx = {
      userId: sender._id,
      transactionId: uuidv4(),
      type: TransactionTypeEnum.DEBIT,
      amount: totalDebit, // user paid amount + fee
      description:
        platformFee > 0
          ? `Sent ${amt} to ${receiver.fullName} (includes fee ${platformFee})`
          : `Sent ${amt} to ${receiver.fullName}`,
      ...baseMeta,
    };

    const receiverTx = {
      userId: receiver._id,
      transactionId: uuidv4(),
      type: TransactionTypeEnum.CREDIT,
      amount: amt,
      description: `Received from ${sender.fullName}, email:${sender.email}`,
      ...baseMeta,
    };

    const adminTx =
      platformFee > 0
        ? {
            adminId, // keep a dedicated field if your schema supports it
            transactionId: uuidv4(),
            type: TransactionTypeEnum.CREDIT,
            amount: platformFee,
            description: `Commission from user transfer: sender=${sender.userId} → receiver=${receiver.userId}`,
            ...baseMeta,
          }
        : null;

    // insertMany ignores nulls if you filter them out
    const txDocs = adminTx
      ? [senderTx, receiverTx, adminTx]
      : [senderTx, receiverTx];
    const transactionsList = await Transaction.insertMany(txDocs, { session });

    // ---- Commit ----
    await session.commitTransaction();
    session.endSession();

    return res.status(statusCode.OK).json(
      new ApiResponse(
        statusCode.OK,
        {
          amountSent: amt,
          platformFee,
          totalDebitedFromSender: totalDebit,
          transactionsList,
        },
        "Transfer successful"
      )
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
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
  console.log("JWT Token:", jwtToken);

  const decoded = decodeAccessToken(jwtToken);

  console.log("Decoded Token null:", decoded); // Debugging line

  const {
    entity,
    page: pageQuery,
    limit: limitQuery,
    transactionId,
  } = req.query;

  let userId = decoded?._id;

  let driverIdFromToken = decoded?.driverId;

  console.log("User ID from Token:", userId);
  console.log("Driver ID from Token:", driverIdFromToken);

  if (entity === "driver" && !driverIdFromToken) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid driver token");
  }

  if (entity !== "driver" && !userId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  // ---------------- Single Transaction ----------------
  if (transactionId) {
    const transaction = await Transaction.findOne({
      transactionId: transactionId,
    });

    if (!transaction) {
      throw new ApiError(statusCode.NOT_FOUND, "Transaction not found");
    }

    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(
          statusCode.OK,
          transaction,
          "Transaction details fetched successfully"
        )
      );
  }

  // ---------------- Paginated Transactions ----------------
  const page = Math.max(parseInt(pageQuery) || 1, 1); // min 1
  const limit = Math.min(Math.max(parseInt(limitQuery) || 10, 1), 100); // default 10, max 100

  let Model;
  let txFilter = {};
  let entityExists;

  switch (entity) {
    case "busoperator":
      Model = BusOperatorModel;
      entityExists = await Model.findById(userId);
      if (!entityExists)
        throw new ApiError(statusCode.NOT_FOUND, "Bus Operator not found");
      txFilter.busOperatorId = entityExists._id;
      break;

    case "hotelManager":
      Model = HotelManagerModel;
      entityExists = await Model.findById(userId);
      if (!entityExists)
        throw new ApiError(statusCode.NOT_FOUND, "Hotel Manager not found");
      txFilter.hotelManagerId = entityExists._id;
      break;

    case "driver":
      Model = DriverDetails;
      entityExists = await Model.findOne({ driverId: driverIdFromToken });
      if (!entityExists)
        throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
      txFilter.driverId = driverIdFromToken;
      break;

    default:
      Model = UserModel;
      entityExists = await Model.findById(userId);
      if (!entityExists)
        throw new ApiError(statusCode.NOT_FOUND, "User not found");
      txFilter.userId = userId;
  }

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
          limit,
        },
      },
      "Transactions fetched successfully"
    )
  );
});

const getTransactionInvoice = catchAsyncError(async (req, res) => {
  const { transactionId } = req.params;

  const transaction = await Transaction.findOne({ transactionId });
  if (!transaction) {
    throw new ApiError(statusCode.NOT_FOUND, "Transaction not found");
  }

  // Generate Base64 PDF
  const pdfBase64 = await generateTransactionPDFBase64(transaction);

  return res.status(200).json(
    new ApiResponse(
      statusCode.OK,
      {
        pdfBase64,
      },
      "Transaction details fetched successfully"
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

  const groupStage = (idObj) => ({
    _id: idObj,
    incoming: {
      $sum: { $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", 0] },
    },
    refunded: {
      $sum: {
        $cond: [
          { $and: [{ $eq: ["$type", "DEBIT"] }, { $eq: ["$refund", true] }] },
          "$amount",
          0,
        ],
      },
    },
    withdraw: {
      $sum: {
        $cond: [
          { $and: [{ $eq: ["$type", "DEBIT"] }, { $eq: ["$withdraw", true] }] },
          "$amount",
          0,
        ],
      },
    },
  });

  if (filter === "daily") {
    const startOfDay = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0
      )
    );
    const endOfDay = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59
      )
    );

    txFilter.createdAt = { $gte: startOfDay, $lte: endOfDay };

    const result = await Transaction.aggregate([
      { $match: txFilter },
      { $group: groupStage(null) },
    ]);

    const data = result[0] || { incoming: 0, refunded: 0, withdraw: 0 };
    analytics = [
      {
        date: now.toISOString().split("T")[0], // show UTC date correctly
        incoming: data.incoming,
        refunded: data.refunded,
        withdraw: data.withdraw,
        profit: data.incoming - data.refunded,
      },
    ];
  } else if (filter === "weekly") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    );
    txFilter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };

    const results = await Transaction.aggregate([
      { $match: txFilter },
      {
        $group: {
          ...groupStage({
            week: { $ceil: { $divide: [{ $dayOfMonth: "$createdAt" }, 7] } },
          }),
        },
      },
      { $sort: { "_id.week": 1 } },
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
        profit: weekData ? weekData.incoming - weekData.refunded : 0,
      };
    });
  } else if (filter === "monthly") {
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    txFilter.createdAt = { $gte: yearStart, $lte: yearEnd };

    const results = await Transaction.aggregate([
      { $match: txFilter },
      {
        $group: {
          ...groupStage({
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          }),
        },
      },
      { $sort: { "_id.month": 1 } },
    ]);

    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
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
        profit: monthData ? monthData.incoming - monthData.refunded : 0,
      };
    });
  } else if (filter === "yearly") {
    const startYear = now.getFullYear() - 9;
    const startDate = new Date(startYear, 0, 1);
    txFilter.createdAt = { $gte: startDate, $lte: now };

    const results = await Transaction.aggregate([
      { $match: txFilter },
      { $group: { ...groupStage({ year: { $year: "$createdAt" } }) } },
      { $sort: { "_id.year": 1 } },
    ]);

    analytics = Array.from({ length: 10 }, (_, i) => {
      const year = startYear + i;
      const yearData = results.find((a) => a._id.year === year);
      return {
        year,
        incoming: yearData ? yearData.incoming : 0,
        refunded: yearData ? yearData.refunded : 0,
        withdraw: yearData ? yearData.withdraw : 0,
        profit: yearData ? yearData.incoming - yearData.refunded : 0,
      };
    });
  }

  return res
    .status(statusCode.OK)
    .json(
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

  // take entity from query (default is "user")
  const { entity = "user" } = req.query;

  let userId;
  if (entity === "driver") {
    userId = decoded?.driverId;
  } else {
    userId = decoded?._id;
  }

  if (!userId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    throw new ApiError(statusCode.NOT_FOUND, "Wallet not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, wallet, "wallet fetched successfully")
    );
});

const getWalletAdmin = catchAsyncError(async (req, res) => {
  const superAdmin = await AdminModel.findOne({ role: "SuperAdmin" });
  if (!superAdmin) {
    console.log("Super Admin not found adding to default wallet ADM001");
  }

  const userId = superAdmin?._id || "ADM001";

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

  if (securePinRecord.blockUntil && securePinRecord.blockUntil > new Date()) {
    const remaining = Math.ceil(
      (securePinRecord.blockUntil - new Date()) / 1000
    );
    throw new ApiError(
      statusCode.FORBIDDEN,
      `Too many invalid attempts. Try again after ${remaining} seconds.`
    );
  }

  const isValid = await securePinRecord.verifyPin(pin);

  if (isValid) {
    securePinRecord.failedAttempts = 0;
    securePinRecord.blockUntil = null;
    securePinRecord.blockStage = 0;
    await securePinRecord.save();

    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(
          statusCode.OK,
          { isValid: true },
          "PIN verified successfully"
        )
      );
  }

  securePinRecord.failedAttempts += 1;

  let blockDuration = null;

  if (securePinRecord.blockStage === 0 && securePinRecord.failedAttempts >= 5) {
    blockDuration = 60 * 1000; // 1 min
    securePinRecord.blockStage = 1;
    securePinRecord.failedAttempts = 0;
  } else if (
    securePinRecord.blockStage === 1 &&
    securePinRecord.failedAttempts >= 3
  ) {
    blockDuration = 5 * 60 * 1000; // 5 min
    securePinRecord.blockStage = 2;
    securePinRecord.failedAttempts = 0;
  } else if (
    securePinRecord.blockStage === 2 &&
    securePinRecord.failedAttempts >= 3
  ) {
    blockDuration = 24 * 60 * 60 * 1000; // 1 day
    securePinRecord.blockStage = 3;
    securePinRecord.failedAttempts = 0;
  }

  if (blockDuration) {
    securePinRecord.blockUntil = new Date(Date.now() + blockDuration);
  }

  await securePinRecord.save();

  throw new ApiError(statusCode.BAD_REQUEST, "Invalid PIN");
});

module.exports = {
  deductfromUserWallet,
  refundToUserWallet,
  getTransactions,
  getWallet,
  validatePin,
  getAnalytics,
  userInternalTransaction,
  getWalletAdmin,
  getTransactionInvoice,
};

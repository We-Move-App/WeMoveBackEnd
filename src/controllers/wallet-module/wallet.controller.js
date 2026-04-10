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
  EntryTypeEnum,
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
const TransactionModel = require("../../models/transaction-module/transaction.model");

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

  const superAdmin = await AdminModel.findOne({ role: "SuperAdmin" });
  const adminId = superAdmin?._id || "SYSTEM";

  const trx = await TransactionModel.create({
    transactionId: await TransactionModel.generateTransactionId(),
    transactionType: "Wallet Deduction",
    momoRefId: null,
    bookingId: null,
    status: PaymentStatusEnum.SUCCESS,
    currency: currency || userWallet.currency || process.env.MOMO_CURRENCY,
    totalAmount: Number(amount),
    description: description || "Wallet deduction",
    platformFee: 0,
    operatorShare: 0,
    entries: [
      {
        entityType: "USER",
        entityId: userId,
        name: userExists?.fullName || null,
        type: "DEBIT",
        amount: Number(amount),
      },
      {
        entityType: "ADMIN",
        entityId: adminId,
        name: "SYSTEM",
        type: "CREDIT",
        amount: Number(amount),
      },
    ],
    meta: {
      walletDeduction: true,
      by: "USER",
    },
  });

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        balance: userWallet.balance,
        transactionId: trx.transactionId,
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

  const trx = await TransactionModel.create({
    transactionId: await TransactionModel.generateTransactionId(),
    transactionType: "Wallet Refund",
    momoRefId: null,
    bookingId: null,
    status: PaymentStatusEnum.SUCCESS,
    currency: currency || userWallet.currency || process.env.MOMO_CURRENCY,
    totalAmount: Number(amount),
    description: description || "Wallet refund",
    platformFee: 0,
    operatorShare: 0,
    refund: true,
    entries: [
      {
        entityType: "USER",
        entityId: userId,
        name: userExists?.fullName || null,
        type: "CREDIT",
        amount: Number(amount),
      },
      {
        entityType: "ADMIN",
        entityId: "SYSTEM",
        name: "SYSTEM",
        type: "DEBIT",
        amount: Number(amount),
      },
    ],
    meta: {
      walletRefund: true,
      by: "SYSTEM",
    },
  });

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        balance: userWallet.balance,
        transactionId: trx.transactionId,
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

  const senderId = decoded?.userId;
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

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const commission = await Commission.findOne({
      serviceType: "user",
      status: "active",
    }).session(session);

    const round2 = (n) => Number(Number(n).toFixed(2));

    // Compute commission amount
    const amt = round2(Number(amount));
    let platformFee = 0;

    if (commission) {
      if (
        commission.commissionType === "percentage" &&
        commission.commissionPercentage != null
      ) {
        platformFee = round2(
          (amt * Number(commission.commissionPercentage)) / 100
        );
      } else if (
        commission.commissionType === "fixed" &&
        commission.commissionRate != null
      ) {
        platformFee = round2(Number(commission.commissionRate));
      }
    }

    const totalDebit = round2(amt + platformFee); // what sender pays

    // ---- Load wallets ----
    const [senderWallet, receiverWallet] = await Promise.all([
      Wallet.findOne({ userId: sender._id }).session(session),
      Wallet.findOne({ userId: receiver._id }).session(session),
    ]);

    if (!senderWallet)
      throw new ApiError(statusCode.NOT_FOUND, "Sender wallet not found");
    if (!receiverWallet)
      throw new ApiError(statusCode.NOT_FOUND, "Receiver wallet not found");

    const currency = senderWallet.currency || process.env.MOMO_CURRENCY;

    if (Number(senderWallet.balance) < totalDebit) {
      // Only transaction part: record FAILED ledger (balanced)
      await TransactionModel.create(
        [
          {
            transactionId: await TransactionModel.generateTransactionId(),
            transactionType: "User to User Payment",
            momoRefId: null,
            bookingId: null,
            status: PaymentStatusEnum.FAILED,
            currency,
            totalAmount: totalDebit,
            description: "Transfer failed - insufficient balance",
            platformFee,
            operatorShare: amt,
            entries: [
              {
                entityType: "USER",
                entityId: sender._id,
                name: sender.fullName || null,
                type: "DEBIT",
                amount: totalDebit,
              },
              {
                entityType: "ADMIN",
                entityId: "SYSTEM",
                name: "SYSTEM",
                type: "CREDIT",
                amount: totalDebit,
              },
            ],
            meta: {
              reason: "INSUFFICIENT_BALANCE",
              from: { name: sender.fullName, id: sender.userId },
              to: { name: receiver.fullName, id: receiver.userId },
              amount: amt,
              platformFee,
            },
          },
        ],
        { session }
      );

      throw new ApiError(statusCode.BAD_REQUEST, "Insufficient balance");
    }

    // ---- Find admin for fee credit ----
    const superAdmin = await AdminModel.findOne({ role: "SuperAdmin" }).session(
      session
    );
    const adminId = superAdmin?._id || "ADM001";

    // ---- Apply atomic wallet updates ----
    await Wallet.findOneAndUpdate(
      { _id: senderWallet._id },
      { $inc: { balance: -totalDebit } },
      { session, new: true }
    );

    await Wallet.findOneAndUpdate(
      { _id: receiverWallet._id },
      { $inc: { balance: amt } },
      { session, new: true }
    );

    if (platformFee > 0) {
      await Wallet.findOneAndUpdate(
        { userId: adminId },
        { $inc: { balance: platformFee } },
        { session, new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    // ---- Create transaction (single ledger doc, balanced) ----
    // Credits must equal debits exactly: totalDebit = amt + platformFee
    const entries = [
      {
        entityType: "USER",
        entityId: sender._id,
        name: sender.fullName || null,
        type: "DEBIT",
        amount: totalDebit,
      },
      {
        entityType: "USER",
        entityId: receiver._id,
        name: receiver.fullName || null,
        type: "CREDIT",
        amount: amt,
      },
    ];

    if (platformFee > 0) {
      entries.push({
        entityType: "ADMIN",
        entityId: adminId,
        name: superAdmin?.fullName || "SuperAdmin",
        type: "CREDIT",
        amount: platformFee,
      });
    } else {
      // ensure validator passes if no fee: credit must still equal debit
      // already balanced because totalDebit == amt when platformFee==0
    }

    const [ledgerTx] = await TransactionModel.create(
      [
        {
          transactionId: await TransactionModel.generateTransactionId(),
          transactionType: "User to User Payment",
          momoRefId: null,
          bookingId: null,
          status: PaymentStatusEnum.SUCCESS,
          currency,
          totalAmount: totalDebit,
          description:
            platformFee > 0
              ? `Sent ${amt} to ${receiver.fullName} (includes commission ${platformFee})`
              : `Sent ${amt} to ${receiver.fullName}`,
          platformFee,
          operatorShare: amt,
          entries,
          meta: {
            from: {
              name: sender.fullName,
              id: sender.userId,
            },
            to: {
              name: receiver.fullName,
              id: receiver.userId,
            },
            amountSent: amt,
            platformFee,
            totalDebitedFromSender: totalDebit,
          },
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(statusCode.OK).json(
      new ApiResponse(
        statusCode.OK,
        {
          amountSent: amt,
          platformFee,
          totalDebitedFromSender: totalDebit,
          transactionsList: [ledgerTx],
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
  console.log("Decoded Token null:", decoded);

  const {
    entity,
    page: pageQuery,
    limit: limitQuery,
    transactionId,
  } = req.query;

  const userId = decoded?._id;
  const driverIdFromToken = decoded?.driverId;

  if (entity === "driver" && !driverIdFromToken) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid driver token");
  }

  if (entity !== "driver" && !userId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const round2 = (n) => Number(Number(n || 0).toFixed(2));

  // Convert new-ledger transaction doc to old response shape for a given entity
  const toLegacyTx = (tx, entityType, entityId) => {
    const eIdStr = entityId != null ? String(entityId) : null;

    const entry = (tx.entries || []).find(
      (e) => e.entityType === entityType && String(e.entityId) === eIdStr
    );

    // If not found (shouldn't happen because we filter), fallback to first entry
    const picked = entry || (tx.entries && tx.entries[0]) || null;

    const type = picked?.type || null;
    const amount = picked?.amount != null ? round2(picked.amount) : null;
    const platformFee = round2(tx.platformFee);
    const operatorShare = round2(tx.operatorShare);

    // Old API used: amountPaid = amount - platformFee (mostly for DEBIT views)
    // For CREDIT entries, show full amount as amountPaid.
    const amountPaid =
      amount == null
        ? null
        : type === "DEBIT"
          ? round2(amount - platformFee)
          : amount;

    return {
      _id: tx._id,
      transactionId: tx.transactionId,
      transactionType: tx.transactionType,
      momoRefId: tx.momoRefId ?? null,

      userId: entityType === "USER" ? (entityId ?? null) : null,
      busOperatorId: entityType === "BUS_OPERATOR" ? (entityId ?? null) : null,
      hotelManagerId: entityType === "HOTEL" ? (entityId ?? null) : null,
      adminId: entityType === "ADMIN" ? (entityId ?? null) : null,
      driverId: entityType === "DRIVER" ? (entityId ?? null) : null,

      bookingId: tx.bookingId ?? null,
      type,
      status: tx.status,
      amount,
      currency: tx.currency,
      description: tx.description,

      platformFee,
      operatorShare,

      refund: !!tx.refund,
      withdraw: !!tx.withdraw,
      meta: tx.meta || {},

      __v: tx.__v,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,

      amountPaid,
    };
  };

  // ---------------------------------------------------
  //  SINGLE TRANSACTION
  // ---------------------------------------------------
  if (transactionId) {
    const tx = await TransactionModel.findOne({ transactionId });
    if (!tx) {
      throw new ApiError(statusCode.NOT_FOUND, "Transaction not found");
    }

    // decide which entity is asking (same rules as list)
    let entityType;
    let entityId;

    if (entity === "driver") {
      const driverExists = await DriverDetails.findOne({
        driverId: driverIdFromToken,
      });
      if (!driverExists)
        throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
      entityType = "DRIVER";
      entityId = driverIdFromToken;
    } else if (entity === "busoperator") {
      const bo = await BusOperatorModel.findById(userId);
      if (!bo)
        throw new ApiError(statusCode.NOT_FOUND, "Bus Operator not found");
      entityType = "BUS_OPERATOR";
      entityId = bo._id.toString();
    } else if (entity === "hotelManager") {
      const hm = await HotelManagerModel.findById(userId);
      if (!hm)
        throw new ApiError(statusCode.NOT_FOUND, "Hotel Manager not found");
      entityType = "HOTEL";
      entityId = hm._id.toString();
    } else {
      const u = await UserModel.findById(userId);
      if (!u) throw new ApiError(statusCode.NOT_FOUND, "User not found");
      entityType = "USER";
      entityId = u._id.toString();
    }

    const legacy = toLegacyTx(tx, entityType, entityId);

    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(
          statusCode.OK,
          legacy,
          "Transaction details fetched successfully"
        )
      );
  }

  // ---------------------------------------------------
  //  PAGINATED TRANSACTIONS
  // ---------------------------------------------------
  const page = Math.max(parseInt(pageQuery) || 1, 1);
  const limit = Math.min(Math.max(parseInt(limitQuery) || 10, 1), 100);

  let entityType;
  let entityId; // for matching entries.entityId

  switch (entity) {
    case "busoperator": {
      const entityExists = await BusOperatorModel.findById(userId);
      if (!entityExists)
        throw new ApiError(statusCode.NOT_FOUND, "Bus Operator not found");
      entityType = "BUS_OPERATOR";
      entityId = entityExists._id.toString();
      break;
    }

    case "hotelManager": {
      const entityExists = await HotelManagerModel.findById(userId);
      if (!entityExists)
        throw new ApiError(statusCode.NOT_FOUND, "Hotel Manager not found");
      entityType = "HOTEL";
      entityId = entityExists._id.toString();
      break;
    }

    case "driver": {
      const entityExists = await DriverDetails.findOne({
        driverId: driverIdFromToken,
      });
      if (!entityExists)
        throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
      entityType = "DRIVER";
      entityId = driverIdFromToken; // string
      break;
    }

    default: {
      const entityExists = await UserModel.findById(userId);
      if (!entityExists)
        throw new ApiError(statusCode.NOT_FOUND, "User not found");
      entityType = "USER";
      entityId = entityExists._id.toString();
      break;
    }
  }

  const txFilter = {
    entries: {
      $elemMatch: {
        entityType,
        entityId: entityId, // stored as Mixed; you saved strings in your ledger creation
      },
    },
  };

  let transactions = await TransactionModel.find(txFilter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const totalCount = await TransactionModel.countDocuments(txFilter);

  const legacyTransactions = transactions.map((tx) =>
    toLegacyTx(tx, entityType, entityId)
  );

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        transactions: legacyTransactions,
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

  // Map request entity -> ledger entityType and matching entityId format
  let ledgerEntityType = "USER";
  let ledgerEntityId =
    entity === "driver" ? decoded?.driverId : String(entityExists._id);

  if (entity === "busoperator") {
    ledgerEntityType = "BUS_OPERATOR";
    ledgerEntityId = String(entityExists._id);
  } else if (entity === "hotelManager") {
    ledgerEntityType = "HOTEL";
    ledgerEntityId = String(entityExists._id);
  } else {
    ledgerEntityType = "USER";
    ledgerEntityId = String(userId);
  }

  const now = new Date();
  let analytics = [];

  // Common $match for this entity in ledger entries
  const baseMatch = {
    status: PaymentStatusEnum.SUCCESS,
  };

  // Build an aggregation that:
  // - filters by date range + SUCCESS
  // - unwinds entries
  // - filters entries for current entity only
  // - groups by requested period
  // - sums incoming/refunded/withdraw based on entry.type + parent flags
  const buildPipeline = (dateMatch, groupId) => [
    { $match: { ...baseMatch, ...dateMatch } },
    { $unwind: "$entries" },
    {
      $match: {
        "entries.entityType": ledgerEntityType,
        "entries.entityId": ledgerEntityId,
      },
    },
    {
      $group: {
        _id: groupId,
        incoming: {
          $sum: {
            $cond: [{ $eq: ["$entries.type", "CREDIT"] }, "$entries.amount", 0],
          },
        },
        refunded: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$entries.type", "DEBIT"] },
                  { $eq: ["$refund", true] },
                ],
              },
              "$entries.amount",
              0,
            ],
          },
        },
        withdraw: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$entries.type", "DEBIT"] },
                  { $eq: ["$withdraw", true] },
                ],
              },
              "$entries.amount",
              0,
            ],
          },
        },
      },
    },
  ];

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

    const results = await TransactionModel.aggregate(
      buildPipeline({ createdAt: { $gte: startOfDay, $lte: endOfDay } }, null)
    );

    const data = results[0] || { incoming: 0, refunded: 0, withdraw: 0 };
    analytics = [
      {
        date: now.toISOString().split("T")[0],
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

    const results = await TransactionModel.aggregate([
      ...buildPipeline(
        { createdAt: { $gte: startOfMonth, $lte: endOfMonth } },
        {
          week: { $ceil: { $divide: [{ $dayOfMonth: "$createdAt" }, 7] } },
        }
      ),
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

    const results = await TransactionModel.aggregate([
      ...buildPipeline(
        { createdAt: { $gte: yearStart, $lte: yearEnd } },
        {
          month: { $month: "$createdAt" },
          year: { $year: "$createdAt" },
        }
      ),
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

    const results = await TransactionModel.aggregate([
      ...buildPipeline(
        { createdAt: { $gte: startDate, $lte: now } },
        { year: { $year: "$createdAt" } }
      ),
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

const statusCode = require("../../../utils/constants/statusCode");
const {
  decodeAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const ApiError = require("../../../utils/response/ApiError");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const Transaction = require("../../../models/transaction-module/transaction.model");
const ApiResponse = require("../../../utils/response/ApiResponse");

const getTransactionsSuperAdmin = catchAsyncError(async (req, res) => {
  // ----------------- Step 1: Decode JWT -----------------
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const jwtToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(jwtToken);

  if (!decoded || decoded.role !== "SuperAdmin") {
    throw new ApiError(statusCode.UNAUTHORIZED, "Unauthorized access");
  }

  const superAdminId = decoded._id; // directly from token

  const { page: pageQuery, limit: limitQuery, id: transactionId } = req.query;

  // ----------------- Step 2: Handle Single Transaction -----------------
  if (transactionId) {
    let transaction = await Transaction.findOne({
      transactionId,
      adminId: superAdminId,
    }).lean();

    if (!transaction) {
      throw new ApiError(statusCode.NOT_FOUND, "Transaction not found");
    }

    // Find service type using bookingId
    if (transaction.bookingId) {
      const relatedTxn = await Transaction.findOne({
        bookingId: transaction.bookingId,
        $or: [
          { driverId: { $ne: null } },
          { busOperatorId: { $ne: null } },
          { hotelManagerId: { $ne: null } },
        ],
      }).lean();

      if (relatedTxn) {
        if (relatedTxn.driverId) transaction.serviceType = "ride booking";
        else if (relatedTxn.busOperatorId)
          transaction.serviceType = "bus booking";
        else if (relatedTxn.hotelManagerId)
          transaction.serviceType = "hotel booking";
      }
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

  // ----------------- Step 3: Pagination -----------------
  const page = Math.max(parseInt(pageQuery) || 1, 1);
  const limit = Math.min(Math.max(parseInt(limitQuery) || 10, 1), 100);

  // ----------------- Step 4: Get All SuperAdmin Transactions -----------------
  const txFilter = { adminId: superAdminId };

  let transactions = await Transaction.find(txFilter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // Add serviceType for each transaction
  for (let txn of transactions) {
    if (txn.bookingId) {
      const relatedTxn = await Transaction.findOne({
        bookingId: txn.bookingId,
        $or: [
          { driverId: { $ne: null } },
          { busOperatorId: { $ne: null } },
          { hotelManagerId: { $ne: null } },
        ],
      }).lean();

      if (relatedTxn) {
        if (relatedTxn.driverId) txn.serviceType = "ride booking";
        else if (relatedTxn.busOperatorId) txn.serviceType = "bus booking";
        else if (relatedTxn.hotelManagerId) txn.serviceType = "hotel booking";
      }
    }
  }

  const totalCount = await Transaction.countDocuments(txFilter);

  // ----------------- Step 5: Response -----------------
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

module.exports = { getTransactionsSuperAdmin };

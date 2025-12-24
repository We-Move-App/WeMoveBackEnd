const Transaction = require("../../models/transaction-module/transaction.model");
const statusCode = require("../../utils/constants/statusCode");
const ApiError = require("../../utils/response/ApiError");
const ApiResponse = require("../../utils/response/ApiResponse");
const catchAsyncError = require("../../utils/response/catchAsyncError");
const Wallet = require("../../models/wallet-module/wallets.model");
const {
  PaymentStatusEnum,
  TransactionTypeEnum,
} = require("../../utils/constants/ENUM");
const { getIO } = require("../../socket/index");
const TransactionModel = require("../../models/transaction-module/transaction.model");

function roundToTwo(num) {
  return Math.round(num * 100) / 100;
}

const momoStatus = catchAsyncError(async (req, res) => {
  const { referenceId, status } = req.body;

  if (!referenceId || !status) {
    throw new ApiError(statusCode.BAD_REQUEST, "Missing referenceId or status");
  }

  const transaction = await TransactionModel.findOne({
    momoRefId: referenceId,
  });
  if (!transaction)
    throw new ApiError(statusCode.NOT_FOUND, "Transaction not found");

  transaction.status = status;
  await transaction.save();

  // Get USER entry to identify who to credit
  const userEntry = (transaction.entries || []).find(
    (e) => e.entityType === "USER"
  );

  const userId = userEntry?.entityId;
  const amount = userEntry?.amount != null ? Number(userEntry.amount) : 0;

  if (status === PaymentStatusEnum.SUCCESS) {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw new ApiError(statusCode.NOT_FOUND, "Wallet not found");

    wallet.balance = Number(wallet.balance) + amount;
    await wallet.save();
  }

  const io = getIO();

  io.to(String(userId)).emit("payment:status", {
    ...transaction.toObject(),
    userId,
    amount,
    message:
      status === PaymentStatusEnum.SUCCESS
        ? "Payment successful"
        : "Payment failed",
  });

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, [], "Status updated successfully"));
});

const momoWithdrawStatus = catchAsyncError(async (req, res) => {
  const { referenceId, status } = req.body;

  if (!referenceId || !status) {
    throw new ApiError(statusCode.BAD_REQUEST, "Missing referenceId or status");
  }

  // find the withdraw transaction by momoRefId
  const transaction = await TransactionModel.findOne({
    momoRefId: referenceId,
  });
  if (!transaction) {
    throw new ApiError(statusCode.NOT_FOUND, "Transaction not found");
  }

  transaction.status = status;
  await transaction.save();

  if (status === PaymentStatusEnum.SUCCESS) {
    // determine which entity wallet should be affected (BUS_OPERATOR / HOTEL / DRIVER)
    const debitEntry = (transaction.entries || []).find(
      (e) => e.type === TransactionTypeEnum.DEBIT
    );

    if (!debitEntry || !debitEntry.entityType || debitEntry.entityId == null) {
      throw new ApiError(statusCode.BAD_REQUEST, "Unknown withdraw entity");
    }

    const entityId = debitEntry.entityId;
    const amount = Number(debitEntry.amount) || 0;

    // wallet is stored by userId (same as old), so we use entityId directly
    const wallet = await Wallet.findOne({ userId: entityId });
    if (!wallet) {
      throw new ApiError(statusCode.NOT_FOUND, "Wallet not found");
    }

    // extra check to avoid balance going below minimum
    if (wallet.balance - amount < 1000) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        "Minimum balance requirement not met"
      );
    }

    wallet.balance -= amount;
    await wallet.save();
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, [], "Withdraw status updated successfully")
    );
});

module.exports = { momoStatus, momoWithdrawStatus, roundToTwo };

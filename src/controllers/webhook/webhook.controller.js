const {
  PaymentStatusEnum,
  TransactionTypeEnum,
} = require("../../utils/constants/ENUM");
const Transaction = require("../../models/transaction-module/transaction.model");
const statusCode = require("../../utils/constants/statusCode");
const ApiError = require("../../utils/response/ApiError");
const ApiResponse = require("../../utils/response/ApiResponse");
const catchAsyncError=require('../../utils/response/catchAsyncError')
const Wallet=require('../../models/wallet-module/wallets.model')

const momoStatus = catchAsyncError(async (req, res) => {
  const { referenceId, status } = req.body;

  if (!referenceId || !status) {
    throw new ApiError(statusCode.BAD_REQUEST, "Missing referenceId or status");
  }

  const transaction = await Transaction.findOne({ momoRefId: referenceId });
  if (!transaction) {
    throw new ApiError(statusCode.NOT_FOUND, "Transaction not found");
  }

  transaction.status = status;
  await transaction.save();

  if (status === PaymentStatusEnum.SUCCESS) {
    const wallet = await Wallet.findOne({ userId: transaction.userId });
    if (!wallet) {
      throw new ApiError(statusCode.NOT_FOUND, "Wallet not found");
    }

    if (transaction.type === TransactionTypeEnum.CREDIT) {
      wallet.balance += transaction.amount;
    } else if (transaction.type === TransactionTypeEnum.DEBIT) {
      if (wallet.balance < transaction.amount) {
        throw new ApiError(statusCode.BAD_REQUEST, "Insufficient wallet balance");
      }
      wallet.balance -= transaction.amount;
    }

    await wallet.save();
  }

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, [], "Status updated successfully"));
});

module.exports = {momoStatus};

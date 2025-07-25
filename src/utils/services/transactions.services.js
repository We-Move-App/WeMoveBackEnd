const mongoose = require("mongoose");
const DigitalWalletModel = require("../../models/user-module/user-wallets/user-wallets.model");
const TransactionModel = require("../../models/user-module/transactions/transactions.model");
const UserModel = require("../../models/user-module/user/user.model");
const statusCode = require("../constants/statusCode");
const ApiError = require("../response/ApiError");

const description = {
  ride_payment: "Ride Payment",
  bus_payment: "Bus Payment",
  hotel_payment: "Hotel Payment",
  wallet_transfer: "Wallet Transfer",
};

const isTransactionProcess = async ({
  senderId,
  amount,
  type,
  refId,
  recipientId,
}) => {
  if (!senderId || !amount || !refId) {
    throw new ApiError(statusCode.BAD_REQUEST, "All fields are required");
  }
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find the Super Admin
    const superAdmin = await UserModel.findOne({
      roles: { $in: "superAdmin" },
    }).session(session);
    if (!superAdmin) {
      throw new ApiError(statusCode.NOT_FOUND, "Super admin not found");
    }

    // Find Sender's Wallet
    const senderWallet = await DigitalWalletModel.findOne({
      userId: senderId,
    }).session(session);
    if (!senderWallet) {
      throw new ApiError(statusCode.NOT_FOUND, "Sender wallet not found");
    }

    // Determine the actual recipient (either provided recipient or super admin)
    const finalRecipientId = recipientId || superAdmin._id;

    // Find Recipient's Wallet
    const recipientWallet = await DigitalWalletModel.findOne({
      userId: finalRecipientId,
    }).session(session);
    if (!recipientWallet) {
      throw new ApiError(statusCode.NOT_FOUND, "Recipient wallet not found");
    }

    // Check Sender's Balance
    if (senderWallet.balance < amount) {
      throw new ApiError(statusCode.BAD_REQUEST, "Insufficient balance");
    }

    // Process Transaction
    senderWallet.balance -= amount;
    recipientWallet.balance += amount;

    await senderWallet.save({ session });
    await recipientWallet.save({ session });

    // Create Transaction Record
    const transaction = await TransactionModel.create(
      [
        {
          sender:senderId,
          recipient: finalRecipientId,
          senderWallet: senderWallet._id,
          recipientWallet: recipientWallet._id,
          amount: amount,
          type: type,
          currency: "USD",
          description: description[type] || "Transaction",
          status: "completed",
          referenceId: refId,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      statusCode: statusCode.OK,
      message: "Transaction successful",
      data: {
        sender: senderWallet,
        recipient: recipientWallet,
        transaction,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new ApiError(statusCode.INTERNAL_SERVER_ERROR, error.message);
  }
};

module.exports = { isTransactionProcess };

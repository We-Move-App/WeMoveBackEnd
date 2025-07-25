// models/transaction.model.js
const mongoose = require("mongoose");
const {
  WalletCurrencyEnum,
  TransactionTypeEnum,
  PaymentStatusEnum,
} = require("../../utils/constants/ENUM");

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    transactionId: { type: String, required: true, unique: true }, // UUID you generate
    momoRefId: { type: String, required: true }, // X-Reference-Id used in MoMo API
    type: { type: String, enum: TransactionTypeEnum, required: true }, // CREDIT or DEBIT
    status: {
      type: String,
      enum: PaymentStatusEnum,
      default: PaymentStatusEnum.PENDING,
    },
    amount: { type: Number, required: true },
    currency: {
      type: String,
      enum: WalletCurrencyEnum,
      default: WalletCurrencyEnum.XAF, // or USD/EUR
    },
    description: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);

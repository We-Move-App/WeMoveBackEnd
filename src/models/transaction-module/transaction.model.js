const mongoose = require("mongoose");
const {
  WalletCurrencyEnum,
  TransactionTypeEnum,
  PaymentStatusEnum,
} = require("../../utils/constants/ENUM");

const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true }, // UUID
    momoRefId: { type: String, default: null },
    userId: { type: String, index: true, default: null },
    busOperatorId: { type: String, index: true, default: null },
    hotelManagerId: { type: String, index: true, default: null },
    driverId: { type: String, index: true, default: null },
    adminId: { type: String, index: true, default: null },
    bookingId: { type: String, index: true, required: false },

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
      default: process.env.MOMO_CURRENCY,
    },
    description: String,

    // Commission / Splits
    platformFee: { type: Number, default: 0 },
    operatorShare: { type: Number, default: 0 },

    refund: { type: Boolean, default: false },
    withdraw: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);

const mongoose = require("mongoose");
const {
  WalletCurrencyEnum,
  TransactionTypeEnum,
  PaymentStatusEnum,
} = require("../../utils/constants/ENUM");
const TransactionCounterModel = require("./counter.model");

const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true,}, // UUID
    momoRefId: { type: String, default: null },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // index: true,
      default: null,
    },
    busOperatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusOperator",
      // index: true,
      default: null,
    },
    hotelManagerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel-Manager",
      // index: true,
      default: null,
    },
    adminId: {
      type: String,
      default: null,
    },
    driverId: {
      type: String,
      // index: true,
      default: null,
    },
    bookingId: { type: String,
      //  index: true,
        required: false },
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

transactionSchema.index({ adminId: 1, createdAt: -1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ bookingId: 1 });
transactionSchema.index({ userId: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ driverId: 1 });
transactionSchema.index({ busOperatorId: 1 });
transactionSchema.index({ hotelManagerId: 1 });
transactionSchema.index({ usernameLower: 1 });

transactionSchema.statics.generateTransactionId = async function () {
  const counter = await TransactionCounterModel.findByIdAndUpdate(
    { _id: "transactionId" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const padded = counter.seq.toString().padStart(10, "0");
  return `T${padded}`;
};

module.exports = mongoose.model("Transaction", transactionSchema);

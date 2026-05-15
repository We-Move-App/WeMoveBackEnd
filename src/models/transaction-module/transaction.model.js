const mongoose = require("mongoose");
const {
  WalletCurrencyEnum,
  TransactionTypeEnum,
  PaymentStatusEnum,
} = require("../../utils/constants/ENUM");
const TransactionCounterModel = require("./counter.model");

/**
 * Ledger Entry Schema
 */
const transactionEntrySchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["USER", "HOTEL", "BUS_OPERATOR", "DRIVER", "ADMIN"],
      required: true,
      index: true,
    },

    entityId: {
      type: String, // ObjectId or String
      required: true,
      index: true,
    },

    name: {
      type: String,
      default: null,
    },

    type: {
      type: String,
      enum: TransactionTypeEnum, // CREDIT / DEBIT
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

/**
 * Main Transaction Schema
 */
const transactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    transactionType: {
      type: String,
      required: true,
    },

    momoRefId: {
      type: String,
      default: null,
    },

    bookingId: {
      type: String,
      index: true,
    },

    status: {
      type: String,
      enum: PaymentStatusEnum,
      default: PaymentStatusEnum.PENDING,
      index: true,
    },

    currency: {
      type: String,
      enum: WalletCurrencyEnum,
      default: process.env.MOMO_CURRENCY,
    },

    /**
     * Total amount paid by user
     */
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    description: {
      en: {
        type: String,
        default: null,
      },
      fr: {
        type: String,
        default: null,
      },
    },

    /**
     * Ledger entries
     */
    entries: {
      type: [transactionEntrySchema],
      required: true,
      validate: {
        validator(entries) {
          if (!entries.length) return false;

          const debit = entries
            .filter((e) => e.type === "DEBIT")
            .reduce((s, e) => s + e.amount, 0);

          const credit = entries
            .filter((e) => e.type === "CREDIT")
            .reduce((s, e) => s + e.amount, 0);

          return debit === credit;
        },
        message: "Debit and credit totals must be equal",
      },
    },

    /**
     * Commission / Splits
     */
    platformFee: {
      type: Number,
      default: 0,
    },

    operatorShare: {
      type: Number,
      default: 0,
    },

    refund: {
      type: Boolean,
      default: false,
    },

    withdraw: {
      type: Boolean,
      default: false,
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

/**
 * Indexes for fast queries
 */
transactionSchema.index({ bookingId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ "entries.entityType": 1 });
transactionSchema.index({ "entries.entityId": 1 });

/**
 * Transaction ID Generator
 */
transactionSchema.statics.generateTransactionId = async function () {
  const counter = await TransactionCounterModel.findByIdAndUpdate(
    { _id: "transactionId" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const padded = counter.seq.toString().padStart(10, "0");
  return `T${padded}`;
};

const TransactionModel = mongoose.model("Transaction", transactionSchema);
module.exports = TransactionModel;

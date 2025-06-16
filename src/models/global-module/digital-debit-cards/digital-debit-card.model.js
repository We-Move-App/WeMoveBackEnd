const mongoose = require("mongoose");

// Digital Card Schema
const digitalCardSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },
    cardNumber: {
      type: String,
      required: true,
      unique: true,
      minlength: 16,
      maxlength: 16,
      match: /^[0-9]{16}$/,
    },
    cardHolderName: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["debit", "credit", "prepaid"],
      required: true,
    },
    expirationDate: {
      type: String,
      required: true,
      match: /^(0[1-9]|1[0-2])\/[0-9]{2}$/, // Matches MM/YY format
    },
    cvv: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 4,
      match: /^[0-9]{3,4}$/,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    spendingLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true, 
  }
);

// Middleware to auto-update `updatedAt` field
digitalCardSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const DigitalCard = mongoose.model("DigitalCard", digitalCardSchema);
module.exports = DigitalCard;

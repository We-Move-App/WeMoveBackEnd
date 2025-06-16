const mongoose = require("mongoose");

const digitalWalletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    cardNumber: {
      type: String,
      required: true,
      unique: true,
      minlength: 16,
      maxlength: 16,
      match: /^[0-9]{16}$/,
    },
    walletId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
      enum: ["USD", "EUR", "INR"],
    },
  },
  {
    timestamps: true,
  }
);

const DigitalWalletModel = mongoose.model(
  "Digital-Wallet",
  digitalWalletSchema
);
module.exports = DigitalWalletModel;

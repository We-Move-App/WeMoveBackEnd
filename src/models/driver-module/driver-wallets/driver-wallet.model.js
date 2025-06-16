const mongoose = require("mongoose");

const driverWalletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Driver",
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

const DriverDigitalWalletModel = mongoose.model(
  "DriverWallet",
  driverWalletSchema
);
module.exports = DriverDigitalWalletModel;

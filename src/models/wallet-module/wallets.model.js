// models/userWallet.model.js
const mongoose = require("mongoose");
const { WalletCurrencyEnum } = require("../../utils/constants/ENUM");

const walletSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    balance: { type: Number, default: 0, min: 0 },
    currency: {
      type: String,
      enum: WalletCurrencyEnum,
      default: WalletCurrencyEnum.XAF, // or USD/EUR
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Wallet", walletSchema);

const mongoose = require("mongoose");

const bankDetailsSchema = new mongoose.Schema(
  {
    accountHolderName: {
      type: String,
      trim: true,
    },
    accountNumber: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{10,18}$/, "Please provide a valid account number"],
    },
    bankName: {
      type: String,
      trim: true,
    },
    ifscCode: {
      type: String,
      required: true,
      // match: [/^[A-Z]{3}0[A-Z0-9]{4}$/, "Please provide a valid IFSC code"],
    },
    branchName: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      match: [/^\d{10,15}$/, "Please provide a valid phone number"],
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

const BankModel = mongoose.model("Bank", bankDetailsSchema);
module.exports = { BankModel };
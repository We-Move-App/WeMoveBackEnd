const mongoose = require("mongoose");
const { ImageSchema } = require("../../../utils/validation/forSchema");

const BusOperatorBankSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "BusOperator",
    },
    accountHolderName: {
      type: String,
      trim: true,
    },
    accountNumber: {
      type: String,
      required: false,
      unique: true,
      match: [
        /^\d{8,30}$/,
        "Account number must be between 8 and 30 digits and contain only numbers",
      ],
    },
    bankName: {
      type: String,
      trim: true,
    },
    ifscCode: {
      type: String,
      // required: true,
      // match: [/^[A-Z]{3}0[A-Z0-9]{4}$/, "Please provide a valid IFSC code"],
    },
    branchName: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      match: [/^\d{9}$/, "Phone number must be exactly 9 digits"],
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    bankDocs: {
      required: false,
      type: ImageSchema,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

const BusOperatorBankModel = mongoose.model(
  "BusOperatorBank",
  BusOperatorBankSchema
);
module.exports = { BusOperatorBankModel };

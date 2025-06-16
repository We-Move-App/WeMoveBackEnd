const mongoose = require("mongoose");
const { ImageSchema } = require("../../../utils/validation/forSchema");

const UserBankSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
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
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, "Please provide a valid IFSC code"],
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
    bankDocs: {
      type: ImageSchema,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

const UserBankModel = mongoose.model("UserBank", UserBankSchema);
module.exports = { UserBankModel };

const mongoose = require("mongoose");
const { ImageSchema } = require("../../../utils/validation/forSchema");

const HotelManagerBankSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Hotel-Manager",
    },

    bankDocs: {
      required: false,
      type: ImageSchema,
    },
    bankName: {
      type: String,
      required: false,
    },
    accountHolderName: {
      type: String,
      trim: true,
    },
    accountNumber: {
      type: String,
      required: false,
      sparse: true,
      unique: true,
      match: [/^\d{10,18}$/, "Please provide a valid account number"],
    },

    // ifscCode: {
    //   type: String,
    //   required: true,
    //   // match: [/^[A-Z]{3}0[A-Z0-9]{4}$/, "Please provide a valid IFSC code"],
    // },
    // branchName: {
    //   type: String,
    //   trim: true,
    // },
    // phoneNumber: {
    //   type: String,
    //   match: [/^\d{10,15}$/, "Please provide a valid phone number"],
    // },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const HotelManagerBankModel = mongoose.model(
  "Hotel-Manager-Bank",
  HotelManagerBankSchema
);

module.exports = { HotelManagerBankModel };

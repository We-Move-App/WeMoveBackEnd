const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { ImageSchema } = require("../../../utils/validation/forSchema");

const busDriverSchema = new mongoose.Schema(
  {
    busOperator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusOperator",
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
  
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      match: /^[0-9]{8,15}$/,
      sparse: true,
    },
   assignedBus: { type: mongoose.Schema.Types.ObjectId, ref: "Bus" },

    status: {
      type: String,
      enum: ["unassigned", "assigned"],
      default: "unassigned",
    },
    licenseExpiry: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    driverLicenseFront: {
      type: ImageSchema,
    },
    avatar: {
      type: ImageSchema,
    },
  },
  { timestamps: true }
);

const BusDriverModel = mongoose.model("BusDriver", busDriverSchema);
module.exports = BusDriverModel;

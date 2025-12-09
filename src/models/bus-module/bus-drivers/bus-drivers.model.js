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

    busDriverId: {
      type: String,
      unique: true,
      index: true,
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      validate: {
        validator: function (v) {
          return /^[0-9]{9}$/.test(v);
        },
        message: "Phone number must be exactly 9 digits",
      },
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

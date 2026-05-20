const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const {
  ImageSchema,
  validatePhoneNumber,
} = require("../../../utils/validation/forSchema");

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
      unique: true,
      validate: {
        validator: validatePhoneNumber,
        message: (props) => `${props.value} is not a valid phone number!`,
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

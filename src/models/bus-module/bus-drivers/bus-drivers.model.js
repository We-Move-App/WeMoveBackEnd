const mongoose = require("mongoose");
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
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters long"],
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      match: /^[0-9]{8,15}$/,
      sparse: true,
    },

    licenseExpiry: {
      type: Date,
    },
    assignedBus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
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

const mongoose = require("mongoose");
const { Schema } = mongoose;

const fareSchema = new Schema(
  {
    originalPrice: {
      type: Number,
    },
    priceAfterIncrement: {
      type: Number,
    },
    commissionAmount: {
      type: Number,
    },
    taxAmount: {
      type: Number,
    },
    discountAmount: {
      type: Number,
    },
    finalAmount: {
      type: Number,
    },
  },
  {
    _id: false,
  }
);

function validateSubType(subType, vehicleType) {
  const validSubTypes = {
    taxi: ["sedan", "mini", "economy"],
    bike: ["scooter", "motorbike"],
  };

  return validSubTypes[vehicleType]?.includes(subType) || false;
}

const rideSchema = new mongoose.Schema(
  {
    vehicle: {
      type: String,
      enum: ["bike", "taxi"],
      required: true,
    },
    vehicleType: {
      type: String,
      required: true,
      validate: {
        validator: function (value) {
          return validateSubType(value, this.vehicle);
        },
        message: "Invalid sub-type for the selected vehicle type",
      },
    },
    pickup: {
      address: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    drop: {
      address: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    fare: {
      type: Number,
      required: true,
    },
    detailedFare: {
      type: fareSchema,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
    },
    totalDistance: { type: String },
    totalTime: { type: String },

    status: {
      type: String,
      enum: [
        "CREATED",
        "REQUESTED",
        "SEARCHING_FOR_CAPTAIN",
        "START",
        "ONGOING",
        "ARRIVED",
        "ACCEPTED",
        "REJECTED",
        "COMPLETED",
        "CANCELLED",
        "FAILED",
      ],
      default: "CREATED",
    },
    otp: {
      type: String,
      default: null,
    },
    cancelReason: {
      type: String,
      default: null,
    },
    cancelFeedback: {
      type: String,
      default: null,
    },
    canceledBy: {
      type: String,
      enum: ["USER", "DRIVER"],
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "PAID",
        "FAILED",
        "REFUND_REQUESTED",
        "REFUND_PROCESSING",
        "REFUNDED",
      ],
      default: "PENDING",
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RidePayment",
    },
    driverFeedback: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DriverReview",
    },
    refundAmount: {
      type: Number,
    },
    refundDate: {
      type: Date,
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transactions",
    },
  },
  {
    timestamps: true,
  }
);

const RideModel = mongoose.model("Ride", rideSchema);

module.exports = RideModel;

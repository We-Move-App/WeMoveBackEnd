const mongoose = require("mongoose");
const { Schema } = mongoose;

// Sub-Schema for Pickup and Drop Stops
const StopSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    time: { type: String, required: true },
  },
  { _id: true }
);

// Main Route Schema
const RouteSchema = new Schema(
  {
    busId: {
      type: Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    busRegNumber: {
      type: String,
    },
    routeName: {
      type: String,
      trim: true,
    },
    startLocation: {
      type: String,
      required: true,
      trim: true,
    },
    endLocation: {
      type: String,
      required: true,
      trim: true,
    },
    pickups: [StopSchema],
    drops: [StopSchema],
    totalDistance: {
      type: Number,
      min: 0,
    },
    departureTime: {
      type: String,
      required: true,
    },
    arrivalTime: {
      type: String,
      required: true,
    },
    estimatedTime: {
      type: String,
      // required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    pricePerSeat: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "BusOperator",
      required: true,
    },
    runningDays: {
      type: [String],
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      default: [],
    },
    seats: {
      type: Schema.Types.ObjectId,
      ref: "BusSeatLayout",
    }
  },
  { timestamps: true }
);

const BusRouteModel = mongoose.model("BusRoute", RouteSchema);
module.exports = BusRouteModel;

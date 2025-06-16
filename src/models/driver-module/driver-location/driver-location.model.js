import mongoose from "mongoose";

const driverLocationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },
    currentLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
        default: [0, 0],
      },
    },
    address: String,
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
    },
  },
  {
    timestamps: true,
  }
);

driverLocationSchema.index({ currentLocation: "2dsphere" });

const driverLocationModel = mongoose.model(
  "DriverLocation",
  driverLocationSchema
);
export default driverLocationModel;

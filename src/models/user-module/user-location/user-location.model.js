import mongoose from "mongoose";

const userLocationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

userLocationSchema.index({ currentLocation: "2dsphere" });

const userLocationModel = mongoose.model("UserLocation", userLocationSchema);
export default userLocationModel

const mongoose = require("mongoose");
const { LocationStatusEnum } = require("../../../utils/constants/ENUM");

const driverLocationSchema = new mongoose.Schema(
  {
    driverId: { type: String, required: true, index: true },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    status: {
      type: String,
      enum: Object.values(LocationStatusEnum),
      default: LocationStatusEnum.OFFLINE,
    },
  },
  { timestamps: true }
);

driverLocationSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("DriverLocation", driverLocationSchema);

const mongoose = require("mongoose");
const DriverModel = require("../../driver-module/drivers/drivers.model");
const { Schema } = mongoose;

const driverReviewSchema = new Schema(
  {
    driverId: {
      type: Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rideId: {
      type: Schema.Types.ObjectId,
      ref: "Ride",
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
      maxlength: 500,
      required: true,
    },
    reviewDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const RidesReview = mongoose.model("DriverReview", driverReviewSchema);

driverReviewSchema.post("save", async function (doc, next) {
  try {
    const stats = await RidesReview.aggregate([
      { $match: { driverId: doc.driverId } },
      { $group: { _id: "$driverId", avgRating: { $avg: "$rating" } } },
    ]);

    const newRating = stats.length > 0 ? stats[0].avgRating : 5; // Default to 5 if no reviews exist

    await DriverModel.findByIdAndUpdate(doc.driverId, {
      rating: newRating,
    });

    next();
  } catch (err) {
    next(err);
  }
});

module.exports = RidesReview;

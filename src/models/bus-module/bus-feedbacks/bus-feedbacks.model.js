const mongoose = require("mongoose");
const BusModel = require("../buses/buses.model");
const { Schema } = mongoose;

const busFeedbackSchema = new Schema(
  {
    busId: {
      type: Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "BusBooking",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

busFeedbackSchema.post("save", async function (doc, next) {
  try {
    const stats = await this.constructor.aggregate([
      { $match: { busId: doc.busId } },
      { $group: { _id: "$busId", avgRating: { $avg: "$rating" } } },
    ]);

    if (stats.length > 0) {
      // Update the bus document with the new average rating.
      await BusModel.findByIdAndUpdate(doc.busId, {
        rating: stats[0].avgRating,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
});
// Update bus rating after feedback is deleted
busFeedbackSchema.post("findOneAndDelete", async function (doc, next) {
  try {
    if (doc) {
      const stats = await this.model.aggregate([
        { $match: { busId: doc.busId } },
        { $group: { _id: "$busId", avgRating: { $avg: "$rating" } } },
      ]);

      // If there are feedbacks, update rating to the new average,
      // otherwise, reset the bus rating (e.g., to 0 or null)
      const newRating = stats.length > 0 ? stats[0].avgRating : 0;
      await BusModel.findByIdAndUpdate(doc.busId, { rating: newRating });
    }
    next();
  } catch (err) {
    next(err);
  }
});

const BusFeedbackModel = mongoose.model("BusFeedback", busFeedbackSchema);

module.exports = BusFeedbackModel;

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
      min: 0,
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

// After saving a feedback, update avg rating and count
busFeedbackSchema.post("save", async function (doc, next) {
  try {
    const stats = await this.constructor.aggregate([
      { $match: { busId: doc.busId } },
      {
        $group: {
          _id: "$busId",
          avgRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      await BusModel.findByIdAndUpdate(doc.busId, {
        rating: Number(stats[0].avgRating.toFixed(1)),
        ratingCount: stats[0].totalRatings
      });
    }

    next();
  } catch (err) {
    next(err);
  }
});

// After deleting a feedback, update avg rating and count
busFeedbackSchema.post("findOneAndDelete", async function (doc, next) {
  try {
    if (doc) {
      const stats = await this.model.aggregate([
        { $match: { busId: doc.busId } },
        {
          $group: {
            _id: "$busId",
            avgRating: { $avg: "$rating" },
            totalRatings: { $sum: 1 }
          }
        }
      ]);

      const newRating = stats.length > 0 ? Number(stats[0].avgRating.toFixed(1)) : 0;
      const newCount = stats.length > 0 ? stats[0].totalRatings : 0;

      await BusModel.findByIdAndUpdate(doc.busId, {
        rating: newRating,
        ratingCount: newCount
      });
    }

    next();
  } catch (err) {
    next(err);
  }
});

const BusFeedbackModel = mongoose.model("BusFeedback", busFeedbackSchema);
module.exports = BusFeedbackModel;

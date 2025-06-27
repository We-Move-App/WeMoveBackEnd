const mongoose = require("mongoose");
const HotelModel = require("../../../models/hotel-module/hotel-registration/hotel-details.model");
const { Schema } = mongoose;

const hotelFeedbackSchema = new Schema(
  {
    hotelId: {
      type: Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "HotelBooking",
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
    }
  },
  {
    timestamps: true,
  }
);

// ✅ Helper to update Hotel's avg rating and count
async function updateHotelRatingStats(hotelId, model) {
  const stats = await model.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: "$hotelId",
        avgRating: { $avg: "$rating" },
        totalRatingCount: { $sum: 1 },
      },
    },
  ]);

  const rating = stats.length > 0 ? parseFloat(stats[0].avgRating.toFixed(2)) : 0;
  const totalRatingCount = stats.length > 0 ? stats[0].totalRatingCount : 0;

  await HotelModel.findByIdAndUpdate(hotelId, {
    rating,
    totalRatingCount,
  });
}

hotelFeedbackSchema.index({ hotelId: 1, bookingId: 1, userId: 1 }, { unique: true });


// ✅ After new feedback is saved
hotelFeedbackSchema.post("save", async function (doc) {
  try {
    await updateHotelRatingStats(doc.hotelId, this.model);
  } catch (err) {
    console.error("Error updating hotel rating after save:", err);
  }
});

// ✅ After feedback is deleted
hotelFeedbackSchema.post("findOneAndDelete", async function (doc) {
  try {
    if (doc) {
      await updateHotelRatingStats(doc.hotelId, this.model);
    }
  } catch (err) {
    console.error("Error updating hotel rating after delete:", err);
  }
});

// ✅ After feedback is updated
hotelFeedbackSchema.post("findOneAndUpdate", async function (doc) {
  try {
    if (doc) {
      await updateHotelRatingStats(doc.hotelId, this.model);
    }
  } catch (err) {
    console.error("Error updating hotel rating after update:", err);
  }
});

const HotelFeedbackModel = mongoose.model("HotelFeedback", hotelFeedbackSchema);
module.exports = HotelFeedbackModel;

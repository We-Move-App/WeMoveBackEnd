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
    },
    totalRatingCount :{
      type: Number,
      default: 0,     
    }
  },
  {
    timestamps: true,
  }
  
);

// Helper function to update hotel stats (avg rating & total count)
async function updateHotelRatingStats(hotelId, model) {
  const stats = await model.aggregate([
    { $match: { hotelId: hotelId } },
    {
      $group: {
        _id: "$hotelId",
        avgRating: { $avg: "$rating" },
        totalRatingCount: { $sum: 1 },
      },
    },
  ]);

  const rating = stats.length > 0 ? stats[0].avgRating : 0;
  const totalRatingCount = stats.length > 0 ? stats[0].totalRatingCount : 0;

  await HotelModel.findByIdAndUpdate(hotelId, {
    rating,
    totalRatingCount,
  });
}

// Update average rating and count after saving feedback
hotelFeedbackSchema.post("save", async function (doc) {
  try {
    await updateHotelRatingStats(doc.hotelId, this.model);
  } catch (err) {
    console.error("Error updating hotel rating after save:", err);
  }
});

// Update average rating and count after deleting feedback
hotelFeedbackSchema.post("findOneAndDelete", async function (doc) {
  try {
    if (doc) {
      await updateHotelRatingStats(doc.hotelId, this.model);
    }
  } catch (err) {
    console.error("Error updating hotel rating after delete:", err);
  }
});

const HotelFeedbackModel = mongoose.model("HotelFeedback", hotelFeedbackSchema);
module.exports = HotelFeedbackModel;

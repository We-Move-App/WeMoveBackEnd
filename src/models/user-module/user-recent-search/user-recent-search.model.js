const mongoose = require("mongoose");

const recentSearchSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      enum: ["vehicle", "bus", "hotel"],
      required: true,
    },
    searchDetails: {
      vehicle: {
        pickup: {
          address: String,
          latitude: Number,
          longitude: Number,
        },
        drop: {
          address: String,
          latitude: Number,
          longitude: Number,
        },
      },
      bus: {
        from: {
          address: String,
          latitude: Number,
          longitude: Number,
        },
        to: {
          address: String,
          latitude: Number,
          longitude: Number,
        },
      },
      hotel: {
        location: {
          hotelName: String,
          address: String,
          latitude: Number,
          longitude: Number,
        },
      },
    },
    searchTime: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const UserRecentSearchModel = mongoose.model("UserRecentSearch", recentSearchSchema);

module.exports = UserRecentSearchModel;

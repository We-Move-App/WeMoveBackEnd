const mongoose = require("mongoose");

const hotelSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel-Manager",
      required: true,
    },
    hotelName: { type: String, required: true, unique: true },
    businessLicense: { type: String, required: true, unique: true },
    totalRoom: { type: Number, required: true },
    description:
    {
      type: String,

    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,

    },
    totalRatingCount: {
      type: Number,
      default: 0,
    },

    termsAndConditions: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Hotel = mongoose.model("Hotel", hotelSchema);
module.exports = Hotel;

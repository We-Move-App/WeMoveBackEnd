const mongoose = require("mongoose");

const HotelManagerDeviceToken = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel-Manager",
      required: true,
    },
    token: { type: String, required: true, unique: true },
    deviceType: {
      type: String,
      enum: ["android", "ios", "web"],
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 30 * 24 * 60 * 60, 
    },
  },
  { timestamps: true }
);

const HotelManagerDeviceTokenModel = mongoose.model(
  "HotelManagerDeviceToken",
  HotelManagerDeviceToken
);
module.exports = HotelManagerDeviceTokenModel;

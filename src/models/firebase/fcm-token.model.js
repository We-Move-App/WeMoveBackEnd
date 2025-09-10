const mongoose = require("mongoose");

const fcmSchema = new mongoose.Schema({
  userId: { type: String },
  fcmToken: { type: String, required: true },
  deviceType: {
    type: String,
    enum: ["android", "ios", "web"],
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

const FcmTokenModel = mongoose.model("FcmToken", fcmSchema);
module.exports = FcmTokenModel;

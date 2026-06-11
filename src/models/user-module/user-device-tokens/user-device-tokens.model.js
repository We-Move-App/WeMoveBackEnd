const mongoose = require("mongoose");

const UserDeviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: { type: String, required: true, unique: true },
    // deviceType: { type: String, enum: ["android", "ios", "web"], required: true },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 30 * 24 * 60 * 60, // Expires in 30 days
    },
  },
  { timestamps: true }
);

const UserDeviceTokenModel = mongoose.model("UserDeviceToken", UserDeviceTokenSchema);
module.exports = UserDeviceTokenModel;

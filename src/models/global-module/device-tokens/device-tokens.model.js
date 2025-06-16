const mongoose = require("mongoose");
const { Schema } = mongoose;

const deviceTokenSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    deviceType: {
      type: String,
      enum: ["android", "ios", "web"],
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const DeviceTokensModel = mongoose.model("DeviceToken", deviceTokenSchema);
module.exports = DeviceTokensModel;

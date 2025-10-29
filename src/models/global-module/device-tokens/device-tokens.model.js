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
    // deviceType: {
    //   type: String,
    //   enum: ["android", "ios", "web"],
    //   required: false,
    // },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);
deviceTokenSchema.index({ user: 1, token: 1 }, { unique: true });

const DeviceTokensModel = mongoose.model("DeviceToken", deviceTokenSchema);
module.exports = DeviceTokensModel;

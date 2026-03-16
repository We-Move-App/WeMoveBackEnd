const mongoose = require("mongoose");
const { Schema } = mongoose;

const GlobalNotificationSchema = new Schema(
  {
    ownerId: { type: String, required: true },
    title: { type: String, required: true },
    subTitle: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

const GlobalNotificationModel = mongoose.model(
  "GlobalNotification",
  GlobalNotificationSchema
);
module.exports = GlobalNotificationModel;

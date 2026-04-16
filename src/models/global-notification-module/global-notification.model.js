const mongoose = require("mongoose");
const { Schema } = mongoose;

const MultiLangSchema = new Schema(
  {
    en: { type: String, required: true },
    fr: { type: String, required: true },
  },
  { _id: false }
);

const GlobalNotificationSchema = new Schema(
  {
    ownerId: { type: String, required: true },
    title: { type: MultiLangSchema, required: true },
    subTitle: { type: MultiLangSchema, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

const GlobalNotificationModel = mongoose.model(
  "GlobalNotification",
  GlobalNotificationSchema
);

module.exports = GlobalNotificationModel;

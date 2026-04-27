const mongoose = require("mongoose");
const { NotificationTypeEnum } = require("../../utils/constants/ENUM");

const MultiLangSchema = new mongoose.Schema(
  {
    en: { type: String, required: true },
    fr: { type: String, required: true },
  },
  { _id: false }
);

const NotificationSchema = new mongoose.Schema({
  type: { type: String, enum: Object.values(NotificationTypeEnum) },
  title: { type: MultiLangSchema, required: true },
  message: { type: MultiLangSchema, required: true },
  referenceId: String,
  referenceModel: String,
  createdBy: String, // driverId in this case
  recipients: [
    {
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
      role: { type: String, enum: ["SuperAdmin", "Admin", "SubAdmin"] },
      isRead: { type: Boolean, default: false },
      readAt: { type: Date },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

const NotificationModel = mongoose.model(
  "NotificationModel",
  NotificationSchema
);

module.exports = NotificationModel;

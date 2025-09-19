const mongoose = require("mongoose");
const { NotificationTypeEnum } = require("../../utils/constants/ENUM");

const NotificationSchema = new mongoose.Schema({
  type: { type: String, enum: Object.values(NotificationTypeEnum) },
  title: String,
  message: String,
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

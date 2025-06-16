const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  sentStatus: { type: String, enum: ["sent", "failed"], default: "sent" },
  readStatus: { type: String, enum: ["read", "unread"], default: "unread" },
  sentAt: { type: Date, default: Date.now },
});

const NotificationModel = mongoose.model("Notification", NotificationSchema);

module.exports = { NotificationModel };

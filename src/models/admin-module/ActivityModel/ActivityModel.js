const mongoose = require("mongoose");

const UserActivitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    activity: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const UserActivityModel = mongoose.model("UserActivity", UserActivitySchema);
module.exports = { UserActivityModel };

const mongoose = require("mongoose");

const UserActivitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    activity: { type: String, required: true },                                     // Description
    type: { type: String, enum: ["login", "create", "update", "delete", "download"], default: "update" },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }, 
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const UserActivityModel = mongoose.model("UserActivity", UserActivitySchema);
module.exports = { UserActivityModel };

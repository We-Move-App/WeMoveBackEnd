const mongoose = require("mongoose");

const inactiveDriverSchema = new mongoose.Schema(
  {
    originalDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DriverBasicDetails",
    },
    driverId: { type: String },
    fullName: { type: String },
    phoneNo: { type: String },
    email: { type: String },
    gender: { type: String },
    dob: { type: Date },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    createdBy: { type: String, enum: ["user", "admin"] },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    deletedAt: { type: Date, default: Date.now },
    reason: { type: String },
  },
  { timestamps: true, versionKey: false }
);
const InactiveDriverModel = mongoose.model(
  "InactiveDriver",
  inactiveDriverSchema
);

module.exports = InactiveDriverModel;

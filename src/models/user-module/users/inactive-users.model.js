const { default: mongoose } = require("mongoose");

const inactiveUserSchema = new mongoose.Schema(
  {
    originalUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userId: { type: String },

    fullName: { type: String },
    email: { type: String },
    phoneNumber: { type: String },

    dob: { type: Date },
    nationality: { type: String },
    gender: { type: String },
    idNumber: { type: String },

    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    parentUserId: { type: mongoose.Schema.Types.ObjectId },

    deletedAt: { type: Date, default: Date.now },
    reason: { type: String },
  },
  { timestamps: true, versionKey: false }
);

const InactiveUserModel = mongoose.model("InactiveUser", inactiveUserSchema);
module.exports = InactiveUserModel;

const mongoose = require("mongoose");

const otpStorageSchema = new mongoose.Schema({
  contact: { type: String, required: true }, // email or phone
  type: { type: String, enum: ["email", "phone"], required: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  isUsed: { type: Boolean, default: false },
}, {
  timestamps: true,
  indexes: [
    { key: { contact: 1, type: 1 }, unique: true }
  ]
});

module.exports = mongoose.model("OtpStorage", otpStorageSchema);

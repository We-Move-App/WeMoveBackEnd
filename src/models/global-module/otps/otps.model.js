const mongoose = require("mongoose");
const { Schema } = mongoose;

const otpSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 10 * 60 * 1000),
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true } 
);

// otpSchema.index(
//   { phoneNumber: 1, isUsed: 1 },
//   {
//     unique: true,
//     sparse: true,
//     partialFilterExpression: { phoneNumber: { $exists: true } },
//   }
// );
// otpSchema.index(
//   { email: 1, isUsed: 1 },
//   {
//     unique: true,
//     sparse: true,
//     partialFilterExpression: { email: { $exists: true } },
//   }
// );
// otpSchema.index({ ownerId: 1 }, { unique: true, sparse: true });

// // ✅ Automatically deletes expired OTPs after 5 minutes
// otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 600 });

const OtpModel = mongoose.model("Otp", otpSchema);
module.exports = OtpModel;

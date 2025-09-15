const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { hash_rounds } = require("../../../config/config");
const { Schema } = mongoose;

const securePinSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    securePin: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    failedAttempts: {
      type: Number,
      default: 0,
    },
    blockUntil: {
      type: Date,
      default: null,
    },
    blockStage: {
      type: Number,
      default: 0, // 0 → normal, 1 → after 5 attempts, 2 → after 3 attempts, 3 → blocked 1 day
    },
  },
  { timestamps: true }
);

// Method to set a PIN (hashing before saving)
securePinSchema.pre("save", async function (next) {
  if (!this.isModified("securePin")) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(Number(hash_rounds));
    this.securePin = await bcrypt.hash(this.securePin, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to verify a PIN
securePinSchema.methods.verifyPin = async function (pin) {
  return await bcrypt.compare(pin, this.securePin);
};

const SecurePinModel = mongoose.model("SecurePin", securePinSchema);
module.exports = SecurePinModel;

const mongoose = require("mongoose");
const { Schema } = mongoose;

const emailVerifySchema = new Schema({
  email: {
    type: String,
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 60 * 60 * 1000),
    index: { expires: 0 },
  },
});

const emailVerifyModel = mongoose.model("VerifiedEmail", emailVerifySchema);
module.exports = emailVerifyModel;

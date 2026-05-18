const mongoose = require("mongoose");
const { Schema } = mongoose;

const phoneNumberVerifySchema = new Schema({
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function (value) {
        return /^[0-9]{9}$/.test(value);
      },
      message: "Phone number must be exactly 9 digits",
    },
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

const phoneNumberVerifyModel = mongoose.model(
  "VerifiedPhoneNumber",
  phoneNumberVerifySchema
);
module.exports = phoneNumberVerifyModel;

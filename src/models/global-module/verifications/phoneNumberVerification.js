const mongoose = require("mongoose");
const { Schema } = mongoose;
const {
  validateEmail,
  validatePhoneNumber,
} = require("../../../utils/validation/forSchema");

const phoneNumberVerifySchema = new Schema({
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: validatePhoneNumber,
      message: (props) => `${props.value} is not a valid phone number!`,
    },
    sparse: true,
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

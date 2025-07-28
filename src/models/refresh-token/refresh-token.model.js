const mongoose = require("mongoose");
const { EntityCodeEnum } = require("../../utils/constants/ENUM");

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  userType: {
    type: String,
    required: true,
    enum: EntityCodeEnum,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  ip: String,
  userAgent: String,
  isRevoked: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);

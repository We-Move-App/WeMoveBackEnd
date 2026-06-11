const mongoose = require("mongoose");
const { Schema } = mongoose;

const accessTokenSchema = new Schema(
  {
    user: {
      type: String,
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);
accessTokenSchema.index({ user: 1, token: 1 }, { unique: true });

const AccessTokenModel = mongoose.model("AccessToken", accessTokenSchema);
module.exports = { AccessTokenModel };

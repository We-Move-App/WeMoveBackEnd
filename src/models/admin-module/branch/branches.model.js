// Branch Schema

const mongoose = require("mongoose");

const BranchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, },
    location: { type: String, required: true },

  },
  {
    timestamps: true
  }
);
const BranchModel = mongoose.model("Branch", BranchSchema);

module.exports = { BranchModel };

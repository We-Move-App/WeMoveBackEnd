// Branch Schema

const mongoose = require("mongoose");

const BranchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    location: { type: String, required: true },
    coordinates: {
      latitude: {
        type: Number,
      },
      longitude: {
        type: Number,
      },
    },
  },
  {
   timestamps:true
  }
);
const BranchModel = mongoose.model("Branch", BranchSchema);

module.exports = { BranchModel };

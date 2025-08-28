// Branch Schema

const mongoose = require("mongoose");

const BranchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    location: { type: String, required: true,
       trim: true,
      unique: true, 
    },
  
  },
  {
   timestamps:true
  }
);
const BranchModel = mongoose.model("Branch", BranchSchema);

module.exports = { BranchModel };

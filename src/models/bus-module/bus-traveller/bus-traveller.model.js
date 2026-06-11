const mongoose = require("mongoose");
const { Schema } = mongoose;

const BusTravellerSchema = new Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, enum: ["male", "female"] },
    contactNumber: { type: String, default: null },
    email: { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
);

const BusTravellerModel = mongoose.model("BusTraveller", BusTravellerSchema);
module.exports = BusTravellerModel;

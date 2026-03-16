const mongoose = require("mongoose");
const { Schema } = mongoose;

const BusTravellerSchema = new Schema(
  {
    userId: { type: String, required: true },
    travellerName: { type: String, required: true },
    travellerAge: { type: Number, required: true },
    travellerGender: { type: String, enum: ["male", "female"] },
    travellerPhoneNumber: { type: String, default: null },
    travellerEmail: { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
);

const BusTravellerModel = mongoose.model("BusTraveller", BusTravellerSchema);
module.exports = BusTravellerModel;

const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    address: { type: String, trim: true },
    townCity: { type: String, trim: true },
    landmark: { type: String, trim: true },
    locality: { type: String, trim: true },
    pincode: {
      type: String,
      match: [/^\d{5,10}$/, "Please provide a valid pincode"],
    },
    country: { type: String },
    state: { type: String },
    coordinates: {
      longitude: { type: String },
      latitude: { type: String },
    },
  },
  { timestamps: true }
);

const AddressModel = mongoose.model("Address", addressSchema);

module.exports = { AddressModel }; 

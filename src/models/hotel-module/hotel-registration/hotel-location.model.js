const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: false,
    },
    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      
      required: true,
       
    },
  },
  { timestamps: true }
);

const HotelAddressModel = mongoose.model("hotel-address", locationSchema);

module.exports = HotelAddressModel;  

const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },
    roomType: {
      type: String,
      enum: ["standard","luxury"],
      required: true,
    },
     standardRoomPrice:{
      type: Number

     },
  luxuryRoomPrice:{
    type: Number

  },
    numberOfRoom: { type: String},


    roomPrice: { type: Number, required: true, min: 0 },

    amenities: [
      {
        name: { type: String, required: true },
        status: { type: Boolean, default: false },
      },
        
    ],
  },
{ timestamps: true }
);

roomSchema.index({ hotelId: 1, roomType: 1 }, { unique: true });

module.exports = mongoose.model("Room", roomSchema);

const mongoose = require("mongoose");
const { Schema } = mongoose;

// Individual room unit schema
const roomUnitSchema = new Schema({
  roomNumber: { type: String, required: true, trim: true },
  isAvailable: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ["booked", "reserved", "cancelled", "available"],
    default: "available",
  },
  bookingReference: {
    type: Schema.Types.ObjectId,
    ref: "HotelBooking",
    default: null,
  },
});

// Room layout for hotel and date
const roomLayoutSchema = new Schema(
  {
    hotelId: { type: Schema.Types.ObjectId, ref: "Hotel", required: true },
    roomType: {
      type: String,
      enum: ["standard", "luxury" ],
      required: true,
    },
    createdDate: { type: Date },
    updatedDate: { type: Date },
    bookingDate: { type: Date, required: true },


    rooms: [roomUnitSchema],

    totalRooms: { type: Number, required: true },
    availableRooms: { type: Number, required: true },

    roomPrice: { type: Number, required: true },

    amenities: [
      {
        name: { type: String, required: true },
        status: { type: Boolean, default: false },
      },
    ],
    bookedRooms: {
      type: Number,
    },    

    createdBy: {
      type: Schema.Types.ObjectId,
      ref:  "Hotel-Manager",
    },
  },
  { timestamps: true }
);

// Unique index to prevent duplicate layouts for the same hotel, roomType, and date
roomLayoutSchema.index({ hotelId: 1, roomType: 1, bookingDate: 1 }, { unique: true });

module.exports = mongoose.model("RoomLayout", roomLayoutSchema);


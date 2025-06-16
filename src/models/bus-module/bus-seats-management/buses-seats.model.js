const mongoose = require("mongoose");
const { Schema } = mongoose;

const seatSchema = new Schema({
  seatNumber: { type: String, required: true, trim: true },
  isAvailable: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ["booked", "reserved", "cancelled", "available"],
    default: "available",
  },
  seatType: {
    type: String,
    enum: ["regular", "window"],
    default: "regular",
  },
  bookingReference: {
    type: Schema.Types.ObjectId,
    ref: "BusBooking",
    default: null,
  },
});

const busSeatsSchema = new Schema(
  {
    busId: { type: Schema.Types.ObjectId, ref: "Bus", required: true },
    seats: [seatSchema],
    noOfSeats: { type: String, required: true },
    journeyDate: { type: Date, required: true },
    routeId: {
      type: Schema.Types.ObjectId,
      ref: "BusRoute",
      required: true,
    },
    bookedSeats: {
      type: Number,
    },
    availableSeats: {
      type: Number,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "BusOperator",
    },
    journeyComplete: {
      type:Boolean,
      default: false
    }
  },
  { timestamps: true }
);

const BusSeatsLayoutModel = mongoose.model("BusSeatLayout", busSeatsSchema);
module.exports = BusSeatsLayoutModel;

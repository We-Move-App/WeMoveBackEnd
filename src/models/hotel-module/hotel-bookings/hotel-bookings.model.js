const mongoose = require("mongoose");
const { ImageSchema } = require("../../../utils/validation/forSchema");
const { Schema } = mongoose;

const passengerSchema = new Schema({
  name: { type: String, required: true, trim: true },
  age: { type: Number, min: 1 },
  gender: { type: String, enum: ["male", "female", "other"] },
  email: { type: String, trim: true },
  phoneNumber: { type: String, trim: true },
  roomsNumber: { type: String },
  identityCard: {
    type: ImageSchema,
  },
});

const HotelBookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      unique: true,
      index: true,
    },
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "bookingBy",
      required: true,
    },
    bookedByOperator: { type: Schema.Types.ObjectId, ref: "Hotel-Manager" },
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },
    roomTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },

    assignedRooms: [
      { type: mongoose.Schema.Types.ObjectId, ref: "individualRoom" },
    ],
    checkInDate: { type: Date, required: true },
    checkOutDate: { type: Date, required: true },
    checkInTime: { type: Date, required: true },
    checkOutTime: { type: Date, required: true },
    totalAmount: { type: Number, required: false },
    finalAmount: { type: Number, required: false },

    couponUsed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },

    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "PAID",
        "FAILED",
        "REFUND_REQUESTED",
        "REFUND_PROCESSING",
        "REFUNDED",
      ],
      default: "PENDING",
    },
    transactionId: {
      type: String,
      ref: "Transactions",
    },
    bookingBy: {
      type: String,
      enum: ["user", "Hotel-Manager"],
      default: "user",
    },
    noOfAdults: { type: Number, required: true },
    noOfKids: { type: Number, default: 0 },
    noOfRoom: { type: Number },
    user: [passengerSchema],
    status: {
      type: String,
      enum: ["Booked", "Cancelled", "Completed"],
      default: "Booked",
    },
    cancelledBy: {
      type: String,
      enum: ["user", "Hotel-Manager"],
    },
    cancelReason: {
      type: String,
    },
  },
  { timestamps: true }
);

const HotelBookingModel = mongoose.model("HotelBooking", HotelBookingSchema);
module.exports = HotelBookingModel;

const mongoose = require("mongoose");
const { Schema } = mongoose;

const passengerSchema = new Schema({
  name: { type: String, required: true, trim: true },
  age: { type: Number, min: 1 },
  gender: { type: String, enum: ["male", "female", "other"] },
  contactNumber: { type: String, required: true, trim: true },
  seatNumber: { type: String },
  email: {
    type: String,
    trim: true,
  },
});

const bookingSchema = new Schema(
  {
    bookingId: {
      type: String,
      unique: true,
      index: true,
    },
    busId: { type: Schema.Types.ObjectId, ref: "Bus", required: true },
    bookedBy: { type: Schema.Types.ObjectId, ref: "User" },
    bookedByOperator: { type: Schema.Types.ObjectId, ref: "BusOperator" },
    from: {
      type: String,
      required: true,
      trim: true,
    },
    to: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    routeId: {
      type: Schema.Types.ObjectId,
      ref: "BusRoute",
      required: true,
    },
    passengers: [passengerSchema],
    seatNumbers: [{ type: String, required: true }],
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

    noOfPassengers: { type: Number, required: true },
    price: { type: Number, required: true, min: 0 },

    journeyDate: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    termAndConditions: { type: Boolean, required: true, default: false },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transactions",
    },
    bookingBy: {
      type: String,
      enum: ["user", "busOperator"],
      default: "user",
    },
    coupon: {
      couponId: { type: Schema.Types.ObjectId, ref: "Coupon" },
      couponCode: { type: String },
      discountType: { type: String, enum: ["Percentage", "Fixed Amount"] },
      discountValue: { type: Number }, // percentage or amount applied
      discountApplied: { type: Number, default: 0 }, // actual ₹ discount
    },
    finalAmount: { type: Number, required: false, min: 0 },

    status: {
      type: String,
      enum: ["Booked", "Cancelled", "Completed"],
      default: "Booked",
    },
    cancelledBy: {
      type: String,
      enum: ["user", "busOperator"],
    },
    cancelReason: {
      type: String,
    },
    isUseronboarded: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const BusBookingModel = mongoose.model("BusBooking", bookingSchema);
module.exports = BusBookingModel;

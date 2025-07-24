const mongoose = require("mongoose");
const {
  RideBookStatusEnum,
  BookPaymentStatusEnum,
  BookCancelledByEnum,
} = require("../../../utils/constants/ENUM");

const locationSchema = new mongoose.Schema({
  address: { type: String, required: true },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
});

locationSchema.index({ location: "2dsphere" });

const polylinePointSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
});

const bookingDetailsSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true },
    driverId: { type: String, index: true },
    userId: {
      type:String,
      required: true,
      index: true,
    },

    pickupLocation: { type: locationSchema, required: true },
    dropLocation: { type: locationSchema, required: true },

    routePolyline: [polylinePointSchema],

    distanceInKm: { type: Number, required: true },
    durationInMin: { type: Number, required: true },
    fare: { type: Number, required: true },

    rideStatus: {
      type: String,
      enum: RideBookStatusEnum,
      default: RideBookStatusEnum.REQUESTED,
    },

    timestamps: {
      requestedAt: { type: Date },
      receivedAt: { type: Date },
      acceptedAt: { type: Date },
      rejectedAt: { type: Date },
      arrivedAt: { type: Date },
      pickupAt: { type: Date },
      rideStartedAt: { type: Date },
      completedAt: { type: Date },
      cancelledAt: { type: Date },
    },

    reasonToCancel: { type: String },
    cancelledBy: { type: String, enum: BookCancelledByEnum },
    cancelledByDrivers: [
      {
        driverId: { type: String, required: true },
        cancelledAt: { type: Date, default: Date.now },
      },
    ],

    waitTimeAtPickupSecond: { type: Number },
    enteredOtp: { type: String },
    expectedOtp: { type: String },
    otpVerified: { type: Boolean, default: false },
    paymentStatus: {
      type: String,
      enum: BookPaymentStatusEnum,
      default: BookPaymentStatusEnum.PENDING,
    },

    feedbackFromUser: { type: String },
    tripRating: { type: Number, min: 1, max: 5 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RideBookingDetail", bookingDetailsSchema);

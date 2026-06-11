const mongoose = require("mongoose");
const { Schema } = mongoose;

const busActivityLogSchema = new Schema({
  action: {
    type: String,
    required: true,
    enum: ["onboard_user", "offboard_user"], // You can expand later
  },
  driver: {
    type: Schema.Types.ObjectId,
    ref: "BusDriver",
    required: true,
  },
  bus: {
    type: Schema.Types.ObjectId,
    ref: "Bus",
    required: true,
  },
  bookingId: {
    type: Schema.Types.ObjectId,
    ref: "BusBooking",
    required: true,
  },
  time: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("BusActivityLog", busActivityLogSchema);

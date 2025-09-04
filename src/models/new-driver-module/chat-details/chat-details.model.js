const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    from: {
      id: { type: String, required: true }, // driverId or userId.toString()
      role: { type: String, enum: ["Driver", "user"], required: true },
    },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const chatSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, index: true },
    driverId: { type: String, required: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    chats: [messageSchema],

    isActive: { type: Boolean, default: true }, // ✅ only one active chat per booking
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);

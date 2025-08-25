// handlers/chatHandler.js
const RideBookingDetail = require("../../models/new-driver-module/booking-details/booking-details.model");

const chatHandler = (socket, io) => {
  // 🚦 Listen for chat messages
  socket.on("chat:message", async (data, ack) => {
    try {
      const { rideId, message } = data;
      console.log("data", data);

      if (!rideId || !message) {
        return ack?.({ success: false, error: "Invalid data" });
      }

      // Get sender info (role + id)
      const sender = {
        id: socket.data.userId || socket.data.driverId,
        role: socket.data.role,
      };

      const chatPayload = {
        rideId,
        from: sender,
        message,
        timestamp: new Date(),
      };

      // 🚕 Put both driver & user into the same room = rideId
      io.to(rideId).emit("chat:message", chatPayload);

      // optional: Save chat in DB (new Chat model if you want persistence)
      // await ChatModel.create(chatPayload);

      ack?.({ ...chatPayload });
    } catch (err) {
      console.error("❌ Chat error:", err);
      ack?.({ success: false, error: "Failed to send message" });
    }
  });
};

module.exports = { chatHandler };

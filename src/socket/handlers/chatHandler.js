const { saveChatMessage } = require("../../utils/chats/saveChatMessage");
const RideModel = require("../../models/new-driver-module/booking-details/booking-details.model");

const chatHandler = (socket, io) => {
  socket.on("chat:message", async (data, ack) => {
    try {
      const { rideId, message } = data;

      if (!rideId || !message) {
        return ack?.({ success: false, error: "Invalid data" });
      }

      // 🔍 get ride details to fetch driverId and userId
      const ride = await RideModel.findOne({ bookingId: rideId }).select(
        "driverId userId bookingId"
      );
      if (!ride) {
        return ack?.({ success: false, error: "Ride not found" });
      }

      const { driverId, userId, bookingId } = ride;

      const sender = {
        id: socket.data.userId || socket.data.driverId,
        role: socket.data.role, // "user" or "Driver"
      };

      // 💾 save in DB
      const chatDoc = await saveChatMessage(
        bookingId, // ✅ use bookingId
        driverId.toString(),
        userId.toString(),
        sender,
        message
      );

      const chatPayload = {
        rideId: bookingId,
        from: {
          id: sender.id,
          role: sender.role,
        },
        message,
        timestamp: new Date(),
      };
      console.log(chatPayload);

      // 📢 broadcast to ride room
      io.to(bookingId).emit("chat:message", chatPayload);

      ack?.({ success: true, chat: chatPayload });
    } catch (err) {
      console.error("❌ Chat error:", err);
      ack?.({ success: false, error: "Failed to send message" });
    }
  });
};

module.exports = { chatHandler };

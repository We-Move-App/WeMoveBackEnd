const { saveChatMessage } = require("../../utils/chats/saveChatMessage");
const RideModel = require("../../models/new-driver-module/booking-details/booking-details.model");
const {
  sendPushNotification,
} = require("../../controllers/firebase/fcm-token.controller");

let globalMessageCounter = 0;

const chatHandler = (socket, io) => {
  socket.on("chat:message", async (data, ack) => {
    const eventId = `msg_${Date.now()}_${++globalMessageCounter}`;

    try {
      const { rideId, message } = data;

      if (!rideId || !message) {
        return ack?.({ success: false, error: "Invalid data" });
      }

      const ride = await RideModel.findOne({ bookingId: rideId }).select(
        "driverId userId bookingId"
      );

      if (!ride) {
        return ack?.({ success: false, error: "Ride not found" });
      }

      const { driverId, userId, bookingId } = ride;

      const sender = {
        id: socket.data.userId || socket.data.driverId,
        role: socket.data.role,
      };

      const chatDoc = await saveChatMessage(
        bookingId,
        driverId.toString(),
        userId.toString(),
        sender,
        message
      );

      const chatPayload = {
        eventId,
        rideId: bookingId,
        from: sender,
        message,
        timestamp: new Date(),
      };

      let emitCount = 0;

      // Emit to USER room
      io.to(userId.toString()).emit("chat:message", chatPayload);
      emitCount++;

      // Emit to DRIVER room
      io.to(driverId.toString()).emit("chat:message", chatPayload);
      emitCount++;

      const targetUserId =
        sender.role === "user" ? driverId.toString() : userId.toString();

      await sendPushNotification(targetUserId, "New Message", message, {
        rideId: bookingId,
      });

      ack?.({ success: true, chat: chatPayload });
    } catch (err) {
      console.error("Chat error:", err);
      ack?.({ success: false, error: "Failed to send message" });
    }
  });
};

module.exports = { chatHandler };

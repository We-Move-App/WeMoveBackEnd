const ChatModel = require("../../models/new-driver-module/chat-details/chat-details.model");

async function saveChatMessage(bookingId, driverId, userId, sender, message) {
  try {
    let chatDoc = await ChatModel.findOne({
      bookingId,
      driverId,
      userId,
      isActive: true,
    });

    if (!chatDoc) {
      // deactivate old chats for this booking
      await ChatModel.updateMany({ bookingId }, { $set: { isActive: false } });

      // create new chat doc
      chatDoc = await ChatModel.create({
        bookingId,
        driverId,
        userId,
        chats: [],
        isActive: true,
      });
    }

    // push message
    chatDoc.chats.push({
      from: sender,
      message,
      timestamp: new Date(),
    });

    await chatDoc.save();
    return chatDoc;
  } catch (err) {
    console.error("❌ Error saving chat:", err);
    throw err;
  }
}

module.exports = { saveChatMessage };

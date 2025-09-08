const ChatModel = require("../../../models/new-driver-module/chat-details/chat-details.model");

// GET /chat/user/:bookingId/:driverId
const getUserChat = async (req, res) => {
  try {
    const { bookingId, driverId } = req.params;
    const userId = req.user._id; // assume userId comes from auth middleware

    const chatDoc = await ChatModel.findOne({ bookingId, driverId, userId });
    if (!chatDoc)
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });

    res.json({ success: true, chats: chatDoc.chats });
  } catch (err) {
    console.error("❌ getUserChat error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// GET /chat/driver/:bookingId
const getDriverChat = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const driverId = req.driverId; // assume driverId comes from driver auth middleware

    const chatDoc = await ChatModel.findOne({ bookingId, driverId });
    if (!chatDoc)
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });

    res.json({ success: true, chats: chatDoc.chats });
  } catch (err) {
    console.error("❌ getDriverChat error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

module.exports = { getUserChat, getDriverChat };

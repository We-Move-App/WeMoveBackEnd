const ChatModel = require("../../../models/new-driver-module/chat-details/chat-details.model");
const UserModel = require("../../../models/user-module/users/user.model");
const statusCode = require("../../../utils/constants/statusCode");
const {
  decodeAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const DriverBasicDetails = require("../../../models/new-driver-module/basic-details/basic-details.model");

const getUserChat = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new ApiError(
        statusCode.UNAUTHORIZED,
        "Access token is missing or invalid"
      );
    }

    const accessToken = authHeader.split(" ")[1];
    const decoded = decodeAccessToken(accessToken);
    const userId = decoded._id;

    if (!userId) {
      throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
    }

    const userExists = await UserModel.findById(userId);

    if (!userExists) {
      throw new ApiError(statusCode.NOT_FOUND, "User not found");
    }
    const { bookingId, driverId } = req.params;

    const chatDoc = await ChatModel.findOne({ bookingId, driverId, userId });
    if (!chatDoc)
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });

    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(statusCode.OK, { chats: chatDoc.chats }, "User Chats")
      );
  } catch (err) {
    console.error("getUserChat error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

const getDriverChat = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new ApiError(
        statusCode.UNAUTHORIZED,
        "Access token is missing or invalid"
      );
    }

    const accessToken = authHeader.split(" ")[1];
    const decoded = decodeAccessToken(accessToken);
    const driverId = decoded?.driverId;

    if (!driverId) {
      throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
    }

    const driverExists = await DriverBasicDetails.exists({ driverId });

    if (!driverExists) {
      throw new ApiError(statusCode.NOT_FOUND, "Driver not found");
    }

    const { bookingId } = req.params;

    const chatDoc = await ChatModel.findOne({ bookingId, driverId });
    if (!chatDoc)
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });

    return res
      .status(statusCode.OK)
      .json(
        new ApiResponse(statusCode.OK, { chats: chatDoc.chats }, "Driver Chats")
      );
  } catch (err) {
    console.error("getDriverChat error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

module.exports = { getUserChat, getDriverChat };

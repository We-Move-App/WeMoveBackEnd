const FcmTokenModel = require("../../models/firebase/fcm-token.model");
const statusCode = require("../../utils/constants/statusCode");
const {
  decodeAccessToken,
} = require("../../utils/jwtToken/customTokenService");
const ApiError = require("../../utils/response/ApiError");
const ApiResponse = require("../../utils/response/ApiResponse");
const catchAsyncError = require("../../utils/response/catchAsyncError");
const { messaging } = require("../../config/firebase");

const addFcmToken = catchAsyncError(async (req, res) => {
  let userId = null;

  try {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith("Bearer ")) {
      const accessToken = authHeader.split(" ")[1];
      const decoded = decodeAccessToken(accessToken);

      if (decoded?.role === "user") {
        userId = decoded._id || null;
      } else if (decoded?.role === "Driver") {
        userId = decoded.driverId || null;
      }
    }
  } catch (err) {
    // Ignore decode errors, userId stays null
  }

  const { fcmToken, deviceType } = req.body;

  if (!fcmToken) {
    throw new ApiError(statusCode.BAD_REQUEST, "fcmToken is required");
  }

  if (!deviceType) {
    throw new ApiError(statusCode.BAD_REQUEST, "deviceType is required");
  }

  let savedToken = await FcmTokenModel.findOne({ fcmToken });

  if (savedToken) {
    // 🔹 Case 1: Same token exists → just update details
    savedToken.userId = userId;
    savedToken.deviceType = deviceType;
    savedToken.createdAt = Date.now();
    await savedToken.save();
  } else {
    // 🔹 Case 2: Token not found → check if user already has a token for this device
    savedToken = await FcmTokenModel.findOne({ userId, deviceType });

    if (savedToken) {
      // Update existing user+device record with new fcmToken
      savedToken.fcmToken = fcmToken;
      savedToken.createdAt = Date.now();
      await savedToken.save();
    } else {
      // 🔹 Case 3: completely new entry
      savedToken = await FcmTokenModel.create({
        userId,
        fcmToken,
        deviceType,
      });
    }
  }

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        savedToken,
        "FCM token saved successfully"
      )
    );
});

async function sendPushNotification(userId, title, body, data = {}) {
  try {
    const tokens = await FcmTokenModel.find({ userId }).select("fcmToken -_id");

    if (!tokens?.length) {
      console.log(`⚠️ No FCM tokens for userId: ${userId}`);
      return;
    }

    const deviceTokens = tokens.map((t) => t.fcmToken).filter(Boolean);
    if (!deviceTokens.length) return;

    const message = {
      notification: { title, body },
      data: { ...data, click_action: "FLUTTER_NOTIFICATION_CLICK" },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "high_importance_channel",
          notificationPriority: "PRIORITY_MAX",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            contentAvailable: true,
            alert: { title, body },
          },
        },
      },
      tokens: deviceTokens,
    };

    // 🔥 FIX: use sendEachForMulticast instead of sendMulticast
    const response = await messaging.sendEachForMulticast(message);

    console.log(
      `✅ Push sent: ${response.successCount} success, ${response.failureCount} failed`
    );

    if (response.failureCount > 0) {
      response.responses.forEach(async (resp, idx) => {
        if (!resp.success) {
          console.error(
            `❌ Failed to send to token ${deviceTokens[idx]}:`,
            resp.error
          );

          if (
            resp.error.code === "messaging/registration-token-not-registered" ||
            resp.error.code === "messaging/invalid-argument"
          ) {
            await FcmTokenModel.deleteOne({ fcmToken: deviceTokens[idx] });
            console.log(`🗑 Removed invalid FCM token: ${deviceTokens[idx]}`);
          }
        }
      });
    }
  } catch (err) {
    console.error("❌ Push notification error:", err.message);
  }
}

module.exports = { addFcmToken, sendPushNotification };

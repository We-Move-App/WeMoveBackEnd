
const {
  NotificationModel,
} = require("../../models/global-module/notifications/notifications.model");
const statusCode = require("../constants/statusCode");
const { validateRequestBody } = require("../reqFunctions/reqFunction");
const ApiError = require("../response/ApiError");
const ApiResponse = require("../response/ApiResponse");
const {
  sendNotificationByFirebase,
  sendMulticastNotification,
} = require("./firebase-notifications.services");

// Function to send notifications
// const sendNotificationsToUsers = async ({
//   userIds,
//   title,
//   body,
//   data = {},
// }) => {
//   try {
//     if (!Array.isArray(userIds) || userIds.length === 0) {
//       throw new ApiError(
//         statusCode.BAD_REQUEST,
//         "Please provide an array of user IDs"
//       );
//     }

//     // Create notifications for each token and save to DB
//     const notificationsToSave = userIds?.map(({ userId }) => ({
//       userId,
//       title,
//       message: body,
//     }));

//     const [savedNotifications, tokens] = await Promise.all([
//       NotificationModel.insertMany(notificationsToSave),
//       await DeviceTokensModel.find({ user: { $in: userIds } }).select(
//         "user token"
//       ),
//     ]);

//     if (tokens.length === 0) {
//       return { success: false, message: "No device tokens found" };
//     }

//     const deviceTokens = tokens.map(({ token }) => token);

//     // Use multicast if multiple tokens exist
//     if (deviceTokens.length > 1) {
//       return await sendMulticastNotification({
//         deviceTokens,
//         title,
//         body,
//         customData: data,
//       });
//     }

//     // Send a single notification if only one token exists
//     return await sendNotificationByFirebase({
//       deviceToken: deviceTokens[0],
//       title,
//       body,
//       customData: data,
//     });
//   } catch (error) {
//     console.error("Error sending notifications:", error);
//     return { success: false, error: error.message };
//   }
// };
const sendNotificationsToUsers = async ({ userIds, title, body, data = {}, reqModel }) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please provide an array of user IDs");
  }

  // Fetch all device tokens for the given users
  const tokens = await reqModel.find({ userId: { $in: userIds } }).select("userId token");

  if (tokens.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "No tokens found");
  }

  // Group device tokens by userId
  const userDeviceMap = tokens.reduce((acc, { userId, token }) => {
    if (!acc[userId]) acc[userId] = { userId, deviceTokens: [] };
    acc[userId].deviceTokens.push(token);
    return acc;
  }, {});

  // Save notifications to the database
  const notifications = Object.values(userDeviceMap).map(({ userId }) => ({
    userId,
    title,
    message: body,
  }));

  const savedNotifications = await NotificationModel.insertMany(notifications);

  // Send notifications to users
  await Promise.all(
    savedNotifications.map(({ userId, _id }) => {
      const { deviceTokens } = userDeviceMap[userId];
      const notificationData = { ...data, notificationId: _id.toString() };
      
      return deviceTokens.length > 1
        ? sendMulticastNotification({ deviceTokens, title, body, customData: notificationData })
        : sendNotificationByFirebase({ deviceToken: deviceTokens[0], title, body, customData: notificationData });
    })
  );

  return new ApiResponse(statusCode.OK, {}, "Notifications sent successfully");
};

const getAllNotifications = async (userId, req) => {
  const { status } = req.query;

  const filter = { userId };
  if (status === "read" || status === "unread") filter.readStatus = status;

  const notifications = await NotificationModel.find(filter).sort({
    sentAt: -1,
  });
  return new ApiResponse(
    statusCode.OK,
    notifications,
    "Notifications retrieved successfully"
  );
};

const getSingleNotificationById = async (req) => {
  const { _id: userId } = req.user;
  const { notificationId } = req.params;

  const notification = await NotificationModel.findOne({
    _id: notificationId,
    userId,
  });
  if (!notification)
    throw new ApiError(statusCode.NOT_FOUND, "Notification not found");

  return new ApiResponse(
    statusCode.OK,
    notification,
    "Notification retrieved successfully"
  );
};

const markAsReadSingle = async (req) => {
  const { notificationId } = req.params;

  const notification = await NotificationModel.findByIdAndUpdate(
    notificationId,
    { readStatus: "read" },
    { new: true }
  );

  if (!notification)
    throw new ApiError(statusCode.NOT_FOUND, "Notification not found");

  return new ApiResponse(
    statusCode.OK,
    notification,
    "Notification marked as read"
  );
};

const markAsReadMultiple = async (req) => {
  const { notificationIds } = req.body;

  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid notification IDs");
  }

  await NotificationModel.updateMany(
    { _id: { $in: notificationIds } },
    { readStatus: "read" }
  );

  return new ApiResponse(
    statusCode.OK,
    {},
    "Selected notifications marked as read"
  );
};

const markAsReadAll = async (req) => {
  const { _id: userId } = req.user;

  await NotificationModel.updateMany(
    { userId, readStatus: "unread" },
    { readStatus: "read" }
  );

  return new ApiResponse(statusCode.OK, {}, "All notifications marked as read");
};

const deleteSingleNotification = async (req) => {
  const { notificationId } = req.params;

  const notification =
    await NotificationModel.findByIdAndDelete(notificationId);
  if (!notification)
    throw new ApiError(statusCode.NOT_FOUND, "Notification not found");

  return new ApiResponse(
    statusCode.OK,
    {},
    "Notification deleted successfully"
  );
};

const deleteMultipleNotificationsAtOnce = async (req) => {
  const { notificationIds } = req.body;

  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid notification IDs");
  }

  await NotificationModel.deleteMany({ _id: { $in: notificationIds } });

  return new ApiResponse(
    statusCode.OK,
    {},
    "Selected notifications deleted successfully"
  );
};

module.exports = {
  getAllNotifications,
  getSingleNotificationById,
  markAsReadSingle,
  markAsReadMultiple,
  markAsReadAll,
  deleteMultipleNotificationsAtOnce,
  deleteSingleNotification,
  sendNotificationsToUsers,
};

const statusCode = require("../../../utils/constants/statusCode");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  getAllNotifications,
  getSingleNotificationById,
  markAsReadSingle,
  markAsReadMultiple,
  markAsReadAll,
  deleteMultipleNotificationsAtOnce,
  deleteSingleNotification,
} = require("../../../utils/services/notifications.services");


const getNotifications = catchAsyncError(async (req, res) => {
  const { _id: userId } = req.user;

  const response = await getAllNotifications(userId, req);

  return res.status(statusCode.OK).json(response);
});

// 📌 2. Get Notification by ID
const getNotificationById = catchAsyncError(async (req, res) => {
  const notification = await getSingleNotificationById(req);
  return res.status(statusCode.OK).json(notification);
});

// 📌 3. Mark a Single Notification as Read
const markAsRead = catchAsyncError(async (req, res) => {
  const { notificationId } = req.params;

  const notification = await markAsReadSingle(req);

  return res.status(statusCode.OK).json(notification);
});

// 📌 4. Mark Multiple Notifications as Read
const markMultipleAsRead = catchAsyncError(async (req, res) => {
  const response = await markAsReadMultiple(req);

  return res.status(statusCode.OK).json(response);
});

// 📌 5. Mark All Notifications as Read
const markAllAsRead = catchAsyncError(async (req, res) => {
  const response = await markAsReadAll(req);
  return res.status(statusCode.OK).json(response);
});

// 📌 6. Delete a Single Notification
const deleteNotification = catchAsyncError(async (req, res) => {
  const response = await deleteSingleNotification(req);

  return res.status(statusCode.OK).json(response);
});

// 📌 7. Delete Multiple Selected Notifications
const deleteMultipleNotifications = catchAsyncError(async (req, res) => {
  const response = await deleteMultipleNotificationsAtOnce(req);

  return res.status(statusCode.OK).json(response);
});

module.exports = {
  getNotifications,
  getNotificationById,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteNotification,
  deleteMultipleNotifications,
};

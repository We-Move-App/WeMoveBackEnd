const UserDeviceTokenModel = require("../../../models/user-module/user-device-tokens/user-device-tokens.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");

const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  getAllNotifications,
  getSingleNotificationById,
  markAsReadSingle,
  markAsReadMultiple,
  markAsReadAll,
  deleteMultipleNotificationsAtOnce,
  deleteSingleNotification,
  sendNotificationsToUsers,
} = require("../../../utils/services/notifications.services");

const sendSingleNotificationsToUsers = catchAsyncError(
  async (req, res, next) => {
    const { userIds, title, body, data } = req.body;

    const result = await sendNotificationsToUsers({
      userIds,
      title,
      body,
      data,
      req,
      res,
      reqModel: UserDeviceTokenModel,
    });
    console.log(result);
  }
);


const getNotifications = catchAsyncError(async (req, res) => {
  const { _id: userId } = req.user;

  const response = await getAllNotifications(userId, req);

  return res.status(statusCode.OK).json(response);
});


const getNotificationById = catchAsyncError(async (req, res) => {
  const notification = await getSingleNotificationById(req);
  return res.status(statusCode.OK).json(notification);
});


const markAsRead = catchAsyncError(async (req, res) => {
  const { notificationId } = req.params;

  const notification = await markAsReadSingle(req);

  return res.status(statusCode.OK).json(notification);
});


const markMultipleAsRead = catchAsyncError(async (req, res) => {
  const response = await markAsReadMultiple(req);

  return res.status(statusCode.OK).json(response);
});


const markAllAsRead = catchAsyncError(async (req, res) => {
  const response = await markAsReadAll(req);
  return res.status(statusCode.OK).json(response);
});


const deleteNotification = catchAsyncError(async (req, res) => {
  const response = await deleteSingleNotification(req);

  return res.status(statusCode.OK).json(response);
});


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
  sendSingleNotificationsToUsers,
};

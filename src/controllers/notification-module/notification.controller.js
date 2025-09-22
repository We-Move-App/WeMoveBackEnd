const { default: mongoose } = require("mongoose");
const { AdminModel } = require("../../models/admin-module/admin/admin.model");
const statusCode = require("../../utils/constants/statusCode");
const {
  decodeAccessToken,
} = require("../../utils/jwtToken/customTokenService");
const ApiResponse = require("../../utils/response/ApiResponse");
const NotificationModel = require("../../models/notification-module/notification.model");
const ApiError = require("../../utils/response/ApiError");
const catchAsyncError = require("../../utils/response/catchAsyncError");

const updateReadStatusAdmin = catchAsyncError(async (req, res) => {
  const { notificationId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid notificationId");
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const adminId = decoded?._id;
  if (!adminId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const adminExists = await AdminModel.findById(adminId);
  if (!adminExists) {
    throw new ApiError(statusCode.NOT_FOUND, "Admin not found");
  }

  const notification = await NotificationModel.findById(notificationId);
  if (!notification) {
    throw new ApiError(statusCode.NOT_FOUND, "Notification not found");
  }

  const recipient = notification.recipients.find(
    (r) => r.adminId.toString() === adminId.toString()
  );

  if (!recipient) {
    throw new ApiError(
      statusCode.FORBIDDEN,
      "This notification is not assigned to you"
    );
  }

  if (!recipient.isRead) {
    recipient.isRead = true;
    recipient.readAt = new Date();
    await notification.save();
  }

  // 🔹 Return only this admin’s recipient data
  const formatted = {
    _id: notification._id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    referenceId: notification.referenceId,
    referenceModel: notification.referenceModel,
    createdBy: notification.createdBy,
    recipients: [
      {
        adminId: recipient.adminId,
        role: recipient.role,
        isRead: recipient.isRead,
        _id: recipient._id,
        readAt: recipient.readAt || null,
      },
    ],
    createdAt: notification.createdAt,
    __v: notification.__v,
  };

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        formatted,
        "Notification marked as read successfully"
      )
    );
});

const getAllNotificationsAdmin = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const adminId = decoded?._id;
  if (!adminId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const adminExists = await AdminModel.findById(adminId);
  if (!adminExists) {
    throw new ApiError(statusCode.NOT_FOUND, "Admin not found");
  }

  const notifications = await NotificationModel.find({
    "recipients.adminId": adminId,
  })
    .sort({ createdAt: -1 }) // LIFO
    .lean();

  let unreadCount = 0;

  const formatted = notifications.map((n) => {
    const recipient = n.recipients.find(
      (r) => r.adminId.toString() === adminId.toString()
    );

    if (recipient && !recipient.isRead) {
      unreadCount++;
    }

    return {
      _id: n._id,
      type: n.type,
      title: n.title,
      message: n.message,
      referenceId: n.referenceId,
      referenceModel: n.referenceModel,
      createdBy: n.createdBy,
      recipients: recipient
        ? [
            {
              adminId: recipient.adminId,
              role: recipient.role,
              isRead: recipient.isRead,
              readAt: recipient.readAt || null,
            },
          ]
        : [],
      createdAt: n.createdAt,
      __v: n.__v,
    };
  });

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        notifications: formatted,
        unreadCount,
      },
      "Notifications fetched successfully"
    )
  );
});

module.exports = { updateReadStatusAdmin, getAllNotificationsAdmin };

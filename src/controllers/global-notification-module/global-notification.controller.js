const GlobalNotificationModel = require("../../models/global-notification-module/global-notification.model");
const statusCode = require("../../utils/constants/statusCode");
const ApiError = require("../../utils/response/ApiError");
const ApiResponse = require("../../utils/response/ApiResponse");
const catchAsyncError = require("../../utils/response/catchAsyncError");

async function createNotification(ownerId, title, subTitle) {
  if (!ownerId || !title || !subTitle) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "ownerId, title, subTitle is required"
    );
  }

  const notification = await GlobalNotificationModel.create({
    ownerId,
    title,
    subTitle,
  });

  return notification;
}

const getNotifications = catchAsyncError(async (req, res, next) => {
  const role = req.user.role;
  let ownerId = req.user._id;

  if (role === "Driver") {
    ownerId = req.user.driverId;
  }
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    GlobalNotificationModel.find({ ownerId })
      .sort({ createdAt: -1 }) // latest first
      .skip(skip)
      .limit(limit),

    GlobalNotificationModel.countDocuments({ ownerId }),
  ]);

  return res.status(statusCode.OK).json(
    new ApiResponse(
      statusCode.OK,
      {
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        notifications,
      },
      "Notifications fetched"
    )
  );
});

module.exports = { createNotification, getNotifications };

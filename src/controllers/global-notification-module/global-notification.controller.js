const GlobalNotificationModel = require("../../models/global-notification-module/global-notification.model");
const statusCode = require("../../utils/constants/statusCode");
const ApiError = require("../../utils/response/ApiError");
const ApiResponse = require("../../utils/response/ApiResponse");
const catchAsyncError = require("../../utils/response/catchAsyncError");

async function createNotification(ownerId, title, subTitle) {
  if (!ownerId) {
    throw new ApiError(statusCode.BAD_REQUEST, "ownerId is required");
  }

  if (!title || typeof title !== "object" || !title.en || !title.fr) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "title must contain both 'en' and 'fr' values"
    );
  }

  if (
    !subTitle ||
    typeof subTitle !== "object" ||
    !subTitle.en ||
    !subTitle.fr
  ) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "subTitle must contain both 'en' and 'fr' values"
    );
  }

  const notification = await GlobalNotificationModel.create({
    ownerId,
    title: {
      en: title.en,
      fr: title.fr,
    },
    subTitle: {
      en: subTitle.en,
      fr: subTitle.fr,
    },
  });

  return notification;
}

const getNotifications = catchAsyncError(async (req, res, next) => {
  const role = req.user.role;
  let ownerId = req.user._id;
  const ln = req.get("ln") || "en";

  if (role === "Driver") {
    ownerId = req.user.driverId;
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    GlobalNotificationModel.find({ ownerId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    GlobalNotificationModel.countDocuments({ ownerId }),
  ]);

  const localizedNotifications = notifications.map((notification) => ({
    _id: notification._id,
    ownerId: notification.ownerId,
    title: notification.title?.[ln] || notification.title?.en || "",
    subTitle: notification.subTitle?.[ln] || notification.subTitle?.en || "",
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  }));

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
        notifications: localizedNotifications,
      },
      ln === "fr"
        ? "Notifications récupérées avec succès"
        : "Notifications fetched successfully"
    )
  );
});

module.exports = { createNotification, getNotifications };

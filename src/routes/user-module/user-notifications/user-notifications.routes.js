const express = require("express");
const {
  getNotifications,
  getNotificationById,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteNotification,
  deleteMultipleNotifications,
} = require("../../../controllers/user-module/user-notifications/user-notifications.controllers");
const { isUserAuthenticated } = require("../../../middlewares/authUser");

const userNotificationRoutes = express.Router();

// Get Notifications (read/unread/all)
userNotificationRoutes.get("/", isUserAuthenticated, getNotifications);

// Get Single Notification by ID
userNotificationRoutes.get(
  "/:notificationId",
  isUserAuthenticated,
  getNotificationById
);

// Mark Single Notification as Read
userNotificationRoutes.put(
  "/mark-read/:notificationId",
  isUserAuthenticated,
  markAsRead
);

// Mark Multiple Notifications as Read
userNotificationRoutes.put(
  "/mark-read-many",
  isUserAuthenticated,
  markMultipleAsRead
);

// Mark All Notifications as Read
userNotificationRoutes.put(
  "/mark-read-all",
  isUserAuthenticated,
  markAllAsRead
);

// Delete Single Notification
userNotificationRoutes.delete(
  "/delete/:notificationId",
  isUserAuthenticated,
  deleteNotification
);

// Delete Multiple Selected Notifications
userNotificationRoutes.delete(
  "/delete-many",
  isUserAuthenticated,
  deleteMultipleNotifications
);

module.exports = userNotificationRoutes;

const express = require("express");
const {
  getNotifications,
  getNotificationById,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteNotification,
  deleteMultipleNotifications,
  sendSingleNotificationsToUsers,
} = require("../../../controllers/admin-module/admin-notifications/admin-notification.controllers");
const { isAdminAuthenticated } = require("../../../middlewares/authAdmins");

const adminNotificationRoutes = express.Router();

// Get Notifications (read/unread/all)
adminNotificationRoutes.get("/", isAdminAuthenticated, getNotifications);

// Get Single Notification by ID
adminNotificationRoutes.get(
  "/:notificationId",
  isAdminAuthenticated,
  getNotificationById
);

// Mark Single Notification as Read
adminNotificationRoutes.put(
  "/mark-read/:notificationId",
  isAdminAuthenticated,
  markAsRead
);

// Mark Multiple Notifications as Read
adminNotificationRoutes.put(
  "/mark-read-many",
  isAdminAuthenticated,
  markMultipleAsRead
);

// Mark All Notifications as Read
adminNotificationRoutes.put(
  "/mark-read-all",
  isAdminAuthenticated,
  markAllAsRead
);

// Delete Single Notification
adminNotificationRoutes.delete(
  "/delete/:notificationId",
  isAdminAuthenticated,
  deleteNotification
);

// Delete Multiple Selected Notifications
adminNotificationRoutes.delete(
  "/delete-many",
  isAdminAuthenticated,
  deleteMultipleNotifications
);

adminNotificationRoutes.post(
  "/send-notifications",
  isAdminAuthenticated,
  sendSingleNotificationsToUsers
);

module.exports = adminNotificationRoutes;

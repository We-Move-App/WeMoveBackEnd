const express = require("express");
const {
  getNotifications,
  getNotificationById,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteNotification,
  deleteMultipleNotifications,
} = require("../../../controllers/driver-module/driver-notifications/driver-notifications.controllers");
const { isDriverAuthenticated } = require("../../../middlewares/authDriver");

const driverNotificationRoutes = express.Router();

// Get Notifications (read/unread/all)
driverNotificationRoutes.get("/", isDriverAuthenticated, getNotifications);

// Get Single Notification by ID
driverNotificationRoutes.get(
  "/:notificationId",
  isDriverAuthenticated,
  getNotificationById
);

// Mark Single Notification as Read
driverNotificationRoutes.put(
  "/mark-read/:notificationId",
  isDriverAuthenticated,
  markAsRead
);

// Mark Multiple Notifications as Read
driverNotificationRoutes.put(
  "/mark-read-many",
  isDriverAuthenticated,
  markMultipleAsRead
);

// Mark All Notifications as Read
driverNotificationRoutes.put(
  "/mark-read-all",
  isDriverAuthenticated,
  markAllAsRead
);

// Delete Single Notification
driverNotificationRoutes.delete(
  "/delete/:notificationId",
  isDriverAuthenticated,
  deleteNotification
);

// Delete Multiple Selected Notifications
driverNotificationRoutes.delete(
  "/delete-many",
  isDriverAuthenticated,
  deleteMultipleNotifications
);

module.exports = driverNotificationRoutes;

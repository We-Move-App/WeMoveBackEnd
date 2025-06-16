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
const { isBusOperatorAuthenticated } = require("../../../middlewares/authBusOperator");

const busOperatorNotificationRoutes = express.Router();

// Get Notifications (read/unread/all)
busOperatorNotificationRoutes.get("/", isBusOperatorAuthenticated, getNotifications);

// Get Single Notification by ID
busOperatorNotificationRoutes.get(
  "/:notificationId",
  isBusOperatorAuthenticated,
  getNotificationById
);

// Mark Single Notification as Read
busOperatorNotificationRoutes.put(
  "/mark-read/:notificationId",
  isBusOperatorAuthenticated,
  markAsRead
);

// Mark Multiple Notifications as Read
busOperatorNotificationRoutes.put(
  "/mark-read-many",
  isBusOperatorAuthenticated,
  markMultipleAsRead
);

// Mark All Notifications as Read
busOperatorNotificationRoutes.put(
  "/mark-read-all",
  isBusOperatorAuthenticated,
  markAllAsRead
);

// Delete Single Notification
busOperatorNotificationRoutes.delete(
  "/delete/:notificationId",
  isBusOperatorAuthenticated,
  deleteNotification
);

// Delete Multiple Selected Notifications
busOperatorNotificationRoutes.delete(
  "/delete-many",
  isBusOperatorAuthenticated,
  deleteMultipleNotifications
);

module.exports = busOperatorNotificationRoutes;

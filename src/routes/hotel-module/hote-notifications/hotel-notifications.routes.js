const express = require("express");
const {
  getNotifications,
  getNotificationById,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteNotification,
  deleteMultipleNotifications,
} = require("../../../controllers/hotel-module/hotel-notifications/hotel-notifications.controllers");
const { isHotelManagerAuthenticated } = require("../../../middlewares/authHotelManager");

const hotelNotificationRoutes = express.Router();

// Get Notifications (read/unread/all)
hotelNotificationRoutes.get("/", isHotelManagerAuthenticated, getNotifications);

// Get Single Notification by ID
hotelNotificationRoutes.get(
  "/:notificationId",
  isHotelManagerAuthenticated,
  getNotificationById
);

// Mark Single Notification as Read
hotelNotificationRoutes.put(
  "/mark-read/:notificationId",
  isHotelManagerAuthenticated,
  markAsRead
);

// Mark Multiple Notifications as Read
hotelNotificationRoutes.put(
  "/mark-read-many",
  isHotelManagerAuthenticated,
  markMultipleAsRead
);

// Mark All Notifications as Read
hotelNotificationRoutes.put(
  "/mark-read-all",
  isHotelManagerAuthenticated,
  markAllAsRead
);

// Delete Single Notification
hotelNotificationRoutes.delete(
  "/delete/:notificationId",
  isHotelManagerAuthenticated,
  deleteNotification
);

// Delete Multiple Selected Notifications
hotelNotificationRoutes.delete(
  "/delete-many",
  isHotelManagerAuthenticated,
  deleteMultipleNotifications
);

module.exports = hotelNotificationRoutes;

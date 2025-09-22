const express = require("express");
const {
  getAllNotificationsAdmin,
  updateReadStatusAdmin,
} = require("../../controllers/notification-module/notification.controller");
const notificationRouter = express.Router();

notificationRouter.get("/admin-get", getAllNotificationsAdmin);
notificationRouter.post("/admin-read/:notificationId", updateReadStatusAdmin);

module.exports = notificationRouter;

const express = require("express");
const {
  getAllNotificationsAdmin,
  updateReadStatusAdmin,
  deleteAllNotificationsAdmin
} = require("../../controllers/notification-module/notification.controller");
const notificationRouter = express.Router();

notificationRouter.get("/admin-get", getAllNotificationsAdmin);
notificationRouter.post("/admin-read/:notificationId", updateReadStatusAdmin);
notificationRouter.delete("/admin-delete-all", deleteAllNotificationsAdmin);

module.exports = notificationRouter;

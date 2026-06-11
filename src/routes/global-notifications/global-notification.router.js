const express = require("express");
const { authenticate } = require("../../middlewares/authenticator");
const {
  getNotifications,
} = require("../../controllers/global-notification-module/global-notification.controller");
const globalNotificationRouter = express.Router();

globalNotificationRouter.get("/get", authenticate, getNotifications);

module.exports = globalNotificationRouter;

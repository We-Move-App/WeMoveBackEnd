const express = require("express");
const {
  getUserChat,
  getDriverChat,
} = require("../../../controllers/new-driver-module/chat-details/chat-details.controller");
const chatRouter = express.Router();

chatRouter.get("/user/:bookingId/:driverId", getUserChat);
chatRouter.get("/driver/:bookingId", getDriverChat);

module.exports = chatRouter;

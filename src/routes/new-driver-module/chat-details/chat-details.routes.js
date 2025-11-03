const express = require("express");
const {
  getUserChat,
  getDriverChat,
} = require("../../../controllers/new-driver-module/chat-details/chat-details.controller");
const {
  isNDriverAuthenticated,
} = require("../../../middlewares/authNewDriver");
const chatRouter = express.Router();

chatRouter.get(
  "/user/:bookingId/:driverId",
  isNDriverAuthenticated,
  getUserChat
);
chatRouter.get("/driver/:bookingId", isNDriverAuthenticated, getDriverChat);

module.exports = chatRouter;

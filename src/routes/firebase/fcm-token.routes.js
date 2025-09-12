const express = require("express");
const {
  addFcmToken,
} = require("../../controllers/firebase/fcm-token.controller");

const fcmRouter = express.Router();

fcmRouter.post("/token/add", addFcmToken);
module.exports = fcmRouter;

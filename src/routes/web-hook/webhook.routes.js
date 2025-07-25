// routes/webhook.js
const express = require("express");
const { momoStatus } = require("../../controllers/webhook/webhook.controller");
const webhookRouter = express.Router();

webhookRouter.post("/momo-status", momoStatus);

module.exports = webhookRouter;

// routes/webhook.js
const express = require("express");
const { momoStatus,momoWithdrawStatus } = require("../../controllers/webhook/webhook.controller");
const webhookRouter = express.Router();

webhookRouter.post("/momo-status", momoStatus);
webhookRouter.post("/momo-withdraw-status", momoWithdrawStatus);

module.exports = webhookRouter;

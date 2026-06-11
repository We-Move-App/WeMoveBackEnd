const express = require("express");
const {
  requestTopay,withdrawFunds
} = require("../../controllers/momo-mtn/momo-mtn.controller");
const momoRouter = express.Router();

momoRouter.post("/request-to-pay", requestTopay);
momoRouter.post("/withdraw", withdrawFunds);

module.exports = momoRouter;

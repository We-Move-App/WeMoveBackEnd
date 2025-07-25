const express = require("express");
const {
  requestTopay,
} = require("../../controllers/momo-mtn/momo-mtn.controller");
const momoRouter = express.Router();

momoRouter.post("/request-to-pay", requestTopay);

module.exports = momoRouter;

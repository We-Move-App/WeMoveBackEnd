const express = require("express");
const {
  privacyPolicy,
  termsAndCondition,
} = require("../../controllers/static/static-controlle");
const staticRouter = express.Router();

staticRouter.get("/privacy-policy", privacyPolicy);
staticRouter.get("/terms-and-conditions", termsAndCondition);

module.exports = staticRouter;

const express = require("express");
const {
  privacyPolicy,
  termsAndCondition,
  generalDisclaimer,
} = require("../../controllers/static/static-controlle");
const { authenticate } = require("../../middlewares/authenticator");
const staticRouter = express.Router();

staticRouter.get("/privacy-policy", privacyPolicy);
staticRouter.get("/terms-and-conditions", termsAndCondition);
staticRouter.get("/general-disclaimer", generalDisclaimer);

module.exports = staticRouter;

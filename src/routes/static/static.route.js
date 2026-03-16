const express = require("express");
const {
  privacyPolicy,
  termsAndCondition,
  generalDisclaimer,
} = require("../../controllers/static/static-controlle");
const { authenticate } = require("../../middlewares/authenticator");
const staticRouter = express.Router();

staticRouter.get("/privacy-policy", authenticate, privacyPolicy);
staticRouter.get("/terms-and-conditions", authenticate, termsAndCondition);
staticRouter.get("/general-disclaimer", authenticate, generalDisclaimer);

module.exports = staticRouter;

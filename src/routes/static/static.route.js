const express = require("express");
const {
  privacyPolicy,
  termsAndCondition,
  generalDisclaimer,
} = require("../../controllers/static/static-controlle");
const { isUserAuthenticated } = require("../../middlewares/authUser");
const staticRouter = express.Router();

staticRouter.get("/privacy-policy", isUserAuthenticated, privacyPolicy);
staticRouter.get(
  "/terms-and-conditions",
  isUserAuthenticated,
  termsAndCondition
);
staticRouter.get("/general-disclaimer", isUserAuthenticated, generalDisclaimer);

module.exports = staticRouter;

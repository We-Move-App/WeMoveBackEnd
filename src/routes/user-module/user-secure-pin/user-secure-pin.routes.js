const express = require("express");
const { isUserAuthenticated } = require("../../../middlewares/authUser");
const {
  CreateSecurePin,
  ChangeSecurePin,
  ResetSecurePin,
} = require("../../../controllers/user-module/user-secure-pin/user-secure-pin.controllers");
const userSecurePinRoutes = express.Router();

userSecurePinRoutes.route("/create").post(isUserAuthenticated, CreateSecurePin);
userSecurePinRoutes.route("/change").put(isUserAuthenticated, ChangeSecurePin);
userSecurePinRoutes
  .route("/reset-pin")
  .put(isUserAuthenticated, ResetSecurePin);


module.exports = userSecurePinRoutes;

const {
  isHotelManagerAuthenticated,
} = require("../../../middlewares/authHotelManager");
const express = require("express");
const {
  craeteSecurePin,
  ChangeSecurePin,
  ResetSecurePin,
} = require("../../../controllers/hotel-module/hotel-manager-security-pin/hotel-manager-security-pin");
const hotelManagerSecurityPinRoutes = express.Router();
hotelManagerSecurityPinRoutes
  .route("/create")
  .post(isHotelManagerAuthenticated, craeteSecurePin);
hotelManagerSecurityPinRoutes
  .route("/change")
  .post(isHotelManagerAuthenticated, ChangeSecurePin);
hotelManagerSecurityPinRoutes
    .route("/reset-pin")
    .post(isHotelManagerAuthenticated, ResetSecurePin);

module.exports = hotelManagerSecurityPinRoutes;

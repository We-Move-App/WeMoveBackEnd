const express = require("express");
const hotelPolicyRouter = express.Router();

const {
  createHotelPolicy,
  getHotelPolicy,
  updateHotelPolicy,
  deleteHotelPolicy,
} = require("../../../controllers/hotel-module/hotel-registration/hotel-policy.controller");

const { isHotelManagerAuthenticated } = require("../../../middlewares/authHotelManager");
const { uploadDocuments } = require("../../../utils/uploadFiles/multer");


hotelPolicyRouter.post(
  "/",
  isHotelManagerAuthenticated,
  uploadDocuments,
  createHotelPolicy
);

hotelPolicyRouter.get(
  "/:hotelId", 
  isHotelManagerAuthenticated,
  getHotelPolicy
);


hotelPolicyRouter.put(
  "/:hotelId", 
  isHotelManagerAuthenticated,
  uploadDocuments,
  updateHotelPolicy
);


hotelPolicyRouter.delete(
  "/:hotelId", 
  isHotelManagerAuthenticated,
  deleteHotelPolicy
);

module.exports = hotelPolicyRouter;

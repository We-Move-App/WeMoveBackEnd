const express = require("express");
const {
  addHotelImages,
  getHotelImages,
  deleteHotelImage,
  updateHotelImage,
} = require("../../../controllers/hotel-module/hotel-images/hotel-images.controller");
const { uploadHotelImages } = require("../../../utils/uploadFiles/multer");
const { isHotelManagerAuthenticated } = require("../../../middlewares/authHotelManager");

const hotelImagesRoutes = express.Router();

hotelImagesRoutes.route("/:hotelId").get(isHotelManagerAuthenticated, getHotelImages);

hotelImagesRoutes
  .route("/")
  .post(isHotelManagerAuthenticated, uploadHotelImages, addHotelImages);

hotelImagesRoutes
  .route("/")
  .put(isHotelManagerAuthenticated, uploadHotelImages, updateHotelImage);

hotelImagesRoutes.route("/").delete(isHotelManagerAuthenticated, deleteHotelImage);

module.exports = hotelImagesRoutes;

const express = require("express");
const hotelDetailsRouter = express.Router();

const {
  createHotelDetails,
  getAllHotels,
  getHotelById,
  updateHotelById,
  deleteHotelById,
  getHotelByToken,
} = require("../../../controllers/hotel-module/hotel-registration/hotel-details.controller");

const {
  isHotelManagerAuthenticated,
} = require("../../../middlewares/authHotelManager");
const { uploadHotelImages } = require("../../../utils/uploadFiles/multer");

hotelDetailsRouter.post(
  "/create",
  isHotelManagerAuthenticated,
  uploadHotelImages,
  createHotelDetails
);

hotelDetailsRouter.get("/", isHotelManagerAuthenticated, getAllHotels);
hotelDetailsRouter.get(
  "/first-hotel-registeration",
  isHotelManagerAuthenticated,
  getHotelByToken
);

hotelDetailsRouter.get("/:hotelId", isHotelManagerAuthenticated, getHotelById);

hotelDetailsRouter.put(
  "/:hotelId",
  isHotelManagerAuthenticated,
  uploadHotelImages,
  updateHotelById
);

hotelDetailsRouter.delete(
  "/:hotelId",
  isHotelManagerAuthenticated,
  deleteHotelById
);

module.exports = hotelDetailsRouter;

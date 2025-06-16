

const express = require("express");

const {
    createOrUpdateLocation,
    getAddressByHotelId,
    deleteAddressByHotelId,
    updateAddressByHotelId
} = require("../../../controllers/hotel-module/hotel-registration/hotel-address.controller");
const { isHotelManagerAuthenticated } = require("../../../middlewares/authHotelManager");
const addressHotelRouter = express.Router();




addressHotelRouter.post("/", isHotelManagerAuthenticated,createOrUpdateLocation);
addressHotelRouter.get("/:hotelId", isHotelManagerAuthenticated, getAddressByHotelId);
 addressHotelRouter.put("/:hotelId",isHotelManagerAuthenticated, updateAddressByHotelId);
addressHotelRouter.delete("/:hotelId", isHotelManagerAuthenticated,deleteAddressByHotelId);





module.exports = addressHotelRouter;
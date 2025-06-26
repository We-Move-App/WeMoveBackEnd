const express = require("express");
const RoomRouter = express.Router();
const { isHotelManagerAuthenticated } = require("../../../middlewares/authHotelManager");
const { uploadRoomImages } = require("../../../utils/uploadFiles/multer");
const {
  createRoom,
  getRoomByHotelAndType,
   getAllRooms,
  updateRoomByHotelAndType ,
  deleteRoomByHotelAndType,
} = require("../../../controllers/hotel-module/hotel-registration/hotel-room-amenities.controller");

RoomRouter.post("/", isHotelManagerAuthenticated, uploadRoomImages, createRoom);


RoomRouter.get("/", isHotelManagerAuthenticated, getRoomByHotelAndType);

RoomRouter.get("/getAllRooms", isHotelManagerAuthenticated, getAllRooms);

RoomRouter.put("/", isHotelManagerAuthenticated, uploadRoomImages, updateRoomByHotelAndType);


RoomRouter.delete("/", isHotelManagerAuthenticated, deleteRoomByHotelAndType);

module.exports = RoomRouter;


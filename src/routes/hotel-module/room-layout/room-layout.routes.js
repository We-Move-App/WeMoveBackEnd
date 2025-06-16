const express = require("express");
// const {
//   createRoomLayout,
//   getAllRooms, // Renamed to match your controller
//   deleteRooms, // Renamed to match your controller
//   getSingleRoomDetails, // Renamed to match your controller
// } = require("../../../controllers/hotel-module/room-layout/room-layout.controller");
const {getAllRooms,
  getSingleRoomById,
  updateRoom,
  fetchRoomStatus
} = require('../../../controllers/hotel-module/hotel-rooms/hotel-rooms.controller')

const { isHotelManagerAuthenticated } = require("../../../middlewares/authHotelManager");
const { isUserAuthenticated } = require("../../../middlewares/authUser");

const roomLayoutRoutes = express.Router();
roomLayoutRoutes
  .route("/all")
  .get(isHotelManagerAuthenticated, getAllRooms );
//update room by id
roomLayoutRoutes
  .route("/update")
  .put(isHotelManagerAuthenticated, updateRoom);
  //get single room By id
roomLayoutRoutes
  .route("/single-room")
  .get(isHotelManagerAuthenticated, getSingleRoomById);
  roomLayoutRoutes
  .route("/room-status/:hotelId")
  .get(fetchRoomStatus);



module.exports = roomLayoutRoutes;

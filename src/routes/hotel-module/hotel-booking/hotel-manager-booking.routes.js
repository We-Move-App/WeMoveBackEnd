

const express = require("express");

const {
  createBookingByHotelManager,
  getBookingsByHotelManager,
  getRoomsstatus,
  allotRoomToBooking,
} = require("../../../controllers/hotel-module/hotel-booking/hotel-manager-booking.controller");

const { isHotelManagerAuthenticated } = require("../../../middlewares/authHotelManager");
const { uploadDocuments } = require("../../../utils/uploadFiles/multer");

const hotelmanagerBookingRoutes = express.Router();


 hotelmanagerBookingRoutes
  .route("/bookHotel")
  .post(isHotelManagerAuthenticated,uploadDocuments, createBookingByHotelManager);

    
 hotelmanagerBookingRoutes
  .route("/allot-room")
  .put(isHotelManagerAuthenticated, allotRoomToBooking);
 hotelmanagerBookingRoutes
  .route("/bookings")
  .get(isHotelManagerAuthenticated, getBookingsByHotelManager);

module.exports =  hotelmanagerBookingRoutes;

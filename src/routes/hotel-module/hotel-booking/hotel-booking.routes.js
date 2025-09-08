

const express = require("express");
const {
  createBooking,
  // getBookingById,
  getBookings,
  payHotelBookingPayment,
  getTotalAmount,
  getHotelsByLocation,
  getHotelById,
  getUpcomingBookings,
  getPastBookings,
  cancelHotelBooking,
  getCancelReasons






} = require("../../../controllers/hotel-module/hotel-booking/hotel-booking.controller");


const { isUserAuthenticated } = require("../../../middlewares/authUser");

const hotelBookingRoutes = express.Router();


hotelBookingRoutes
  .route("/create-booking")
  .post(isUserAuthenticated, createBooking);

hotelBookingRoutes
  .route("/totalAmount")
  .post(isUserAuthenticated, getTotalAmount)

hotelBookingRoutes
  .route("/bookings")
  .get(isUserAuthenticated, getBookings);

// hotelBookingRoutes
//   .route("/get-booking")
//   .get(isUserAuthenticated, getBookingById);

hotelBookingRoutes
  .route("/pay/:bookingId")
  .post(isUserAuthenticated, payHotelBookingPayment);
hotelBookingRoutes
  .route("/search-hotels")
  .get(isUserAuthenticated, getHotelsByLocation);
hotelBookingRoutes
  .route("/Search-hotel/:hotelId")
  .get(isUserAuthenticated, getHotelById);
hotelBookingRoutes
  .route("/upcoming-bookings")
  .get(isUserAuthenticated, getUpcomingBookings);
hotelBookingRoutes
  .route("/past-bookings")
  .get(isUserAuthenticated, getPastBookings);


hotelBookingRoutes
  .route("/cancel-reasons")
  .get(isUserAuthenticated, getCancelReasons);


hotelBookingRoutes
  .route("/cancel-booking/:bookingId")
  .put(isUserAuthenticated, cancelHotelBooking);
module.exports = hotelBookingRoutes;

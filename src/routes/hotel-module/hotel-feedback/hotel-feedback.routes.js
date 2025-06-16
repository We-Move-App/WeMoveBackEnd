const express = require("express");
const {
  addFeedbackToHotel,
  getHotelFeedback,
  deleteHotelFeedback,
  getAllHotelFeedback,
} = require("../../../controllers/hotel-module/hotel-feedback/hotel-feedback.controller");

const { isUserAuthenticated } = require("../../../middlewares/authUser");
const { isHotelManagerAuthenticated } = require("../../../middlewares/authHotelManager");

const hotelFeedbackRoutes = express.Router();

// Get all feedback for hotels managed by the hotel manager
hotelFeedbackRoutes
  .route("/all")
  .get(isHotelManagerAuthenticated, getAllHotelFeedback);

// Add or update feedback by user
hotelFeedbackRoutes
  .route("/add")
  .post(isUserAuthenticated, addFeedbackToHotel);

//Get specific feedback
hotelFeedbackRoutes
  .route("/")
  .get(isHotelManagerAuthenticated ,getHotelFeedback);

// Delete specific feedback
hotelFeedbackRoutes
  .route("/:id")
  .delete(isHotelManagerAuthenticated, deleteHotelFeedback);

module.exports = hotelFeedbackRoutes;

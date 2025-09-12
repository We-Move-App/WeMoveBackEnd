const express = require("express");




const {
  getProfile,
  getAvatar,
  updateYourProfile,
  changePassword,
  setPassword,
  resetPassword,
  updateAvatar,
  resetPassword2,
  deleteAccount,
  assignBranch,
} = require("../../../controllers/hotel-module/hotel-manager/hotel-managerProfile.controller");

const {
  uploadDocuments,
  uploadAvatar,
} = require("../../../utils/uploadFiles/multer");

const {
  isHotelManagerAuthenticated,
} = require("../../../middlewares/authHotelManager");

const hotelManagerRoutes = express.Router();

hotelManagerRoutes
  .route("/profile")
  .get(isHotelManagerAuthenticated, getProfile);

hotelManagerRoutes
  .route("/get-avatar")
  .get(isHotelManagerAuthenticated, getAvatar);
hotelManagerRoutes
  .route("/update-profile")
  .put(isHotelManagerAuthenticated, uploadDocuments, updateYourProfile);

hotelManagerRoutes
  .route("/change-password")
  .put(isHotelManagerAuthenticated, changePassword);

hotelManagerRoutes
  .route("/set-password")
  .put(isHotelManagerAuthenticated, setPassword);

hotelManagerRoutes
  .route("/reset-password")
  .put(isHotelManagerAuthenticated, resetPassword);

hotelManagerRoutes
  .route("/update-avatar")
  .put(isHotelManagerAuthenticated, uploadAvatar, updateAvatar);
  
  hotelManagerRoutes
  .route("/reset-password2")
  .put(resetPassword2);

  hotelManagerRoutes
  .route("/delete-account")     
  .delete(isHotelManagerAuthenticated, deleteAccount);
  hotelManagerRoutes
  .route("/assign-branch")
    .put(isHotelManagerAuthenticated, assignBranch);


module.exports = hotelManagerRoutes;

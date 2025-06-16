const express = require("express");
const {
  addBusImages,
  getBusImages,
  deleteBusImage,
  updateBusImage,
} = require("../../../controllers/bus-module/bus-images/bus-images.controllers");
const { uploadBusImages } = require("../../../utils/uploadFiles/multer");
const {
  isBusOperatorAuthenticated,
} = require("../../../middlewares/authBusOperator");

const busImagesRoutes = express.Router();

busImagesRoutes.route("/:busId").get(isBusOperatorAuthenticated, getBusImages);

busImagesRoutes
  .route("/")
  .post(isBusOperatorAuthenticated, uploadBusImages, addBusImages);

busImagesRoutes
  .route("/")
  .put(isBusOperatorAuthenticated, uploadBusImages, updateBusImage);

busImagesRoutes.route("/").delete(isBusOperatorAuthenticated, deleteBusImage);

module.exports = busImagesRoutes;

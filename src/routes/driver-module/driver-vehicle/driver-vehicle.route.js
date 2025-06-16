const express = require("express");
const { isDriverAuthenticated } = require("../../../middlewares/authDriver");
const { getVehicle, addVehicle, updateVehicle, deleteVehicle } = require("../../../controllers/driver-module/driver-vehicle/driver-vehicle.controllers");
const { uploadDocuments } = require("../../../utils/uploadFiles/multer");

const driverVehicleRoutes = express.Router();

driverVehicleRoutes.route("/").get(isDriverAuthenticated ,getVehicle);
driverVehicleRoutes.route("/add").post(isDriverAuthenticated, uploadDocuments, addVehicle);
driverVehicleRoutes
  .route("/edit/:id")
  .put(isDriverAuthenticated, updateVehicle);
driverVehicleRoutes
  .route("/delete/:id")
  .delete(isDriverAuthenticated, deleteVehicle);

module.exports = driverVehicleRoutes;

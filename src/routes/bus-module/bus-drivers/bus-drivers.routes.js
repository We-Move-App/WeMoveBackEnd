const express = require("express");

const {
  isBusOperatorAuthenticated,
} = require("../../../middlewares/authBusOperator");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");
const { uploadDocuments } = require("../../../utils/uploadFiles/multer");
const {
  getBusDrivers,
  registerBusDriver,
  assignDriverToBus,
  deleteDrivers,
  getDriverById,
  updateBusDriverDetails,
} = require("../../../controllers/bus-module/bus-drivers/bus-drivers.controllers");

const busDriverRoutes = express.Router();


busDriverRoutes
.route("/:id")
.get(
  isBusOperatorAuthenticated,
  authorizeRole(["bus-operator", "bus-operator-member"]),
  getDriverById
);
busDriverRoutes
  .route("/")
  .get(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    getBusDrivers
  );

busDriverRoutes
  .route("/")
  .post(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    uploadDocuments,
    registerBusDriver
  );

busDriverRoutes
  .route("/assign-driver")
  .put(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    assignDriverToBus
  );

busDriverRoutes
  .route("/:id")
  .put(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    uploadDocuments,
    updateBusDriverDetails
  );

busDriverRoutes
  .route("/:id")
  .delete(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    deleteDrivers
  );

module.exports = busDriverRoutes;

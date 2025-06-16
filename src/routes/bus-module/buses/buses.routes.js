const express = require("express");

const {
  isBusOperatorAuthenticated,
} = require("../../../middlewares/authBusOperator");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");
const { uploadBusImages } = require("../../../utils/uploadFiles/multer");
const {
  addBus,
  updateBus,
  changeBusStatus,
  getAllBuses,
  getSingleBus,
  searchBuses,
  deletePermanentBus,
} = require("../../../controllers/bus-module/buses/buses.controllers");
const { isUserAuthenticated } = require("../../../middlewares/authUser");

const BusesRoutes = express.Router();
BusesRoutes.route("/search-bus").get(isUserAuthenticated,searchBuses);

BusesRoutes.route("/add").post(
  isBusOperatorAuthenticated,
  authorizeRole(["bus-operator", "bus-operator-member"]),
  uploadBusImages,
  addBus
);

BusesRoutes.route("/edit/:busId").put(
  isBusOperatorAuthenticated,
  authorizeRole(["bus-operator", "bus-operator-member"]),
  uploadBusImages,
  updateBus
);

BusesRoutes.route("/:busId").delete(
  isBusOperatorAuthenticated,
  authorizeRole(["bus-operator", "bus-operator-member"]),
  changeBusStatus
);

BusesRoutes.route("/my-buses").get(
  isBusOperatorAuthenticated,
  authorizeRole(["bus-operator", "bus-operator-member"]),
  getAllBuses
);
BusesRoutes.route("/:busId").get(
  isBusOperatorAuthenticated,
  authorizeRole(["bus-operator", "bus-operator-member"]),
  getSingleBus
);

BusesRoutes.route("/delete-permanent/:busId").delete(
  isBusOperatorAuthenticated,
  authorizeRole(["bus-operator", "bus-operator-member"]),
  deletePermanentBus
);

module.exports = BusesRoutes;

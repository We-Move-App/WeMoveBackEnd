const express = require("express");
const { createBusSeat, getBusAllSeats, deleteSeats, getSingleBusSeatDetails } = require("../../../controllers/bus-module/bus-seat-layout/bus-seats.controllers");
const { isBusOperatorAuthenticated } = require("../../../middlewares/authBusOperator");
const { authorizeRole } = require("../../../middlewares/authRoles/authorizeRole");

const busSeatLayoutRoutes = express.Router();

busSeatLayoutRoutes
  .route("/:id")
  .post(isBusOperatorAuthenticated, authorizeRole(["bus-operator"]), createBusSeat);

busSeatLayoutRoutes
  .route("/")
  .get(isBusOperatorAuthenticated, authorizeRole(["bus-operator"]), getBusAllSeats);

busSeatLayoutRoutes
  .route("/delete-seat")
  .delete(isBusOperatorAuthenticated, authorizeRole(["bus-operator"]), deleteSeats);

busSeatLayoutRoutes
  .route("/seat-detail/:busId/:seatId")
  .get(isBusOperatorAuthenticated, authorizeRole(["bus-operator"]), getSingleBusSeatDetails);

module.exports = busSeatLayoutRoutes;

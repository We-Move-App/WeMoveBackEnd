const express = require("express");
const {
  createBusRoute,
  updateBusRoute,
  deleteBusRoute,
  getAllBusRoutes,
  getSingleBusRoutes,
  addPickupDropToRoute,
  getPickUpAndDrops,
  getRoutesOfBusOperator,
  getSingleBusRoutesByBusId,
  updateRouteStatus,
} = require("../../../controllers/bus-module/buses-routes/buses-routes.controllers");
const {
  isBusOperatorAuthenticated,
} = require("../../../middlewares/authBusOperator");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");
const busesRoutesRoutes = express.Router();

busesRoutesRoutes
  .route("/")
  .post(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator"]),
    createBusRoute
  );
busesRoutesRoutes
  .route("/edit/:id")
  .put(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator"]),
    updateBusRoute
  );
busesRoutesRoutes
  .route("/:routeId")
  .delete(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator"]),
    deleteBusRoute
  );
busesRoutesRoutes
  .route("/all/:busId")
  .get(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator"]),
    getAllBusRoutes
  );
busesRoutesRoutes
  .route("/all-routes")
  .get(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator","bus-operator-member"]),
    getRoutesOfBusOperator
  );
busesRoutesRoutes
  .route("/:routeId")
  .get(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator"]),
    getSingleBusRoutes
  );
busesRoutesRoutes
  .route("/bus/:busId")
  .get(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator"]),
    getSingleBusRoutesByBusId
  );
busesRoutesRoutes
  .route("/add-pickup-and-drops/:routeId")
  .put(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator"]),
    addPickupDropToRoute
  );
busesRoutesRoutes
  .route("/add-pickup-and-drops/:routeId")
  .get(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator"]),
    getPickUpAndDrops
  );

busesRoutesRoutes
  .route("/status/:routeId")
  .put(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator"]),
    updateRouteStatus
  );

module.exports = busesRoutesRoutes;

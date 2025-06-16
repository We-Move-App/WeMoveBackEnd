const express = require("express");
const {
  addFeedbackToBus,
  getBusFeedback,
  deleteFeedback,
  getAllFeedback,
} = require("../../../controllers/bus-module/bus-feedbacks/bus-feedbacks.controllers");
const { isUserAuthenticated } = require("../../../middlewares/authUser");
const {
  isBusOperatorAuthenticated,
} = require("../../../middlewares/authBusOperator");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");

const busFeedbackRoutes = express.Router();

busFeedbackRoutes
  .route("/all")
  .get(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    getAllFeedback
  );
busFeedbackRoutes.route("/").post(isUserAuthenticated, addFeedbackToBus);
busFeedbackRoutes
  .route("/:busId/:bookingId")
  .get(isUserAuthenticated, getBusFeedback);
  
busFeedbackRoutes
  .route("/:id")
  .delete(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator", "bus-operator-member"]),
    deleteFeedback
  );

module.exports = busFeedbackRoutes;

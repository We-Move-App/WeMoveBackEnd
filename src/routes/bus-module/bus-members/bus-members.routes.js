const express = require("express");
const {
  addMemberUnderBusOperator,
  getAllMembersUnderBusOperator,
  getSingleMemberUnderBusOperator, // Changed for better naming
  updateBusMemberUnderBusOperator,
  deleteMembersUnderBusOperator,
} = require("../../../controllers/bus-module/bus-members/bus-members.controllers");
const {
  isBusOperatorAuthenticated,
} = require("../../../middlewares/authBusOperator");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");

const busMemberRoutes = express.Router();

// Add a new bus member (Only Bus Operators)
busMemberRoutes.post(
  "/add",
  isBusOperatorAuthenticated,
  authorizeRole(["bus-operator"]),
  addMemberUnderBusOperator
);

// Get all bus members under a particular operator
busMemberRoutes
  .route("/all")
  .get(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator"]),
    getAllMembersUnderBusOperator
  );

// Routes for a single bus member (Get, Update, Delete)
busMemberRoutes
  .route("/:id")
  .get(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator"]),
    getSingleMemberUnderBusOperator
  )
  .put(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator"]),
    updateBusMemberUnderBusOperator
  )
  .delete(
    isBusOperatorAuthenticated,
    authorizeRole(["bus-operator"]),
    deleteMembersUnderBusOperator
  );

module.exports = busMemberRoutes;

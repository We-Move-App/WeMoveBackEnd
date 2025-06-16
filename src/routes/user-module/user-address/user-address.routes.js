const express = require("express");
const { isUserAuthenticated } = require("../../../middlewares/authUser");
const {
  createAddress,
  getAddress,
  updateAddress,
  deleteAddress,
} = require("../../../controllers/user-module/user-address/user-address.controllers");
const UserAddressRoutes = express.Router();

UserAddressRoutes.route("/").post(isUserAuthenticated, createAddress);
UserAddressRoutes.route("/").get(isUserAuthenticated, getAddress);
UserAddressRoutes.route("/").put(isUserAuthenticated, updateAddress);
UserAddressRoutes.route("/").delete(isUserAuthenticated, deleteAddress);

module.exports = UserAddressRoutes;

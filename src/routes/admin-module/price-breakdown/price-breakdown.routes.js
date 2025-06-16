const express = require("express");
const { isAdminAuthenticated } = require("../../../middlewares/authAdmins");
const {
  getPricesBreakDownBySerivceType,
  addPricesBreakDown,
  updatePricesBreakDown,
  getAllPricesBreakDown,
} = require("../../../controllers/admin-module/price-breakdown/price-breakdown.controllers");
const adminPriceBreakRoutes = express.Router();

adminPriceBreakRoutes
  .route("/")
  .get(isAdminAuthenticated, getPricesBreakDownBySerivceType);
adminPriceBreakRoutes
  .route("/all")
  .get(isAdminAuthenticated, getAllPricesBreakDown);
adminPriceBreakRoutes.route("/").post(isAdminAuthenticated, addPricesBreakDown);
adminPriceBreakRoutes
  .route("/:id")
  .put(isAdminAuthenticated, updatePricesBreakDown);

module.exports = {
  adminPriceBreakRoutes,
};

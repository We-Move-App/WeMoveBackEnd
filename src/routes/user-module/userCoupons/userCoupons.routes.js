const express = require("express");
const { isUserAuthenticated } = require("../../../middlewares/authUser");
const { getAllCoupons } = require("../../../controllers/user-module/userCoupons/getUserCoupons");

const userCouponsRoutes = express.Router();

// ✅ Route for fetching all valid coupons
userCouponsRoutes.get(
  "/valid-coupons",
  isUserAuthenticated,
  getAllCoupons
);

module.exports = userCouponsRoutes;

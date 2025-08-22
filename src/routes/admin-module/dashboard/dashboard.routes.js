const express = require("express");
const {
  getTopAnalytics,
} = require("../../../controllers/admin-module/dashboard/dashboard.controller");
const dashBoardRouter = express.Router();

dashBoardRouter.get("/top-analytics", getTopAnalytics);
module.exports = dashBoardRouter;

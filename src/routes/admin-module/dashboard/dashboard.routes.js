const express = require("express");
const {
  getTopAnalytics,
  getTotalCounts,
} = require("../../../controllers/admin-module/dashboard/dashboard.controller");
const dashBoardRouter = express.Router();

dashBoardRouter.get("/top-analytics", getTopAnalytics);
dashBoardRouter.get("/total-counts", getTotalCounts);
module.exports = dashBoardRouter;

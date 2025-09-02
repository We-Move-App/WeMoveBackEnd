const express = require("express");
const { isAdminAuthenticated } = require("../../../middlewares/authAdmins");
const {
  getAllBranches,
  addBranch,
  getBranchById,
  updateBranchById,
  deleteBranchById,
} = require("../../../controllers/admin-module/branches/branches.controllers");
const adminBranchesRoutes = express.Router();

adminBranchesRoutes.route("/all").get( getAllBranches);
adminBranchesRoutes
  .route("/:branchId")
  .get(isAdminAuthenticated, getBranchById);

adminBranchesRoutes.route("/").post(isAdminAuthenticated, addBranch);

adminBranchesRoutes
  .route("/:branchId")
  .put(isAdminAuthenticated, updateBranchById);

adminBranchesRoutes
  .route("/:branchId")
  .delete(isAdminAuthenticated, deleteBranchById);

module.exports = adminBranchesRoutes;

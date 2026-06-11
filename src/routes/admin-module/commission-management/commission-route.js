const express = require("express");
const {
  createCommission,
  getAllCommissions,
  getCommissionById,
  updateCommission,
} = require("../../../controllers/admin-module/commission-management/commission.controller");
const { isAdminAuthenticated } = require("../../../middlewares/authAdmins");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");
const commissionRouter = express.Router();

commissionRouter.post(
  "/create",
  isAdminAuthenticated,
  authorizeRole(["SuperAdmin"]),
  createCommission
);
commissionRouter.get(
  "/get-all",
  isAdminAuthenticated,
  authorizeRole(["SuperAdmin"]),
  getAllCommissions
);
commissionRouter.get(
  "/get/:commissionId",
  isAdminAuthenticated,
  authorizeRole(["SuperAdmin"]),
  getCommissionById
);
commissionRouter.put(
  "/update/:commissionId",
  isAdminAuthenticated,
  authorizeRole(["SuperAdmin"]),
  updateCommission
);

module.exports = commissionRouter;

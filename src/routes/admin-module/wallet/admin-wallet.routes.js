const {
  getTransactionsSuperAdmin,
} = require("../../../controllers/admin-module/wallet/admin-wallet.controllerr");

const express = require("express");
const { isAdminAuthenticated } = require("../../../middlewares/authAdmins");
const {
  authorizeRole,
} = require("../../../middlewares/authRoles/authorizeRole");
const adminWalletRoute = express.Router();

adminWalletRoute.get(
  "/transactions/admin",
  isAdminAuthenticated,
  getTransactionsSuperAdmin
);

module.exports = adminWalletRoute;

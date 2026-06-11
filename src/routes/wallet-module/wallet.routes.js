const express = require("express");
const {
  deductfromUserWallet,
  refundToUserWallet,
  getTransactions,
  getWallet,
  validatePin,
  getAnalytics,
  userInternalTransaction,
  getWalletAdmin,
  getTransactionInvoice,
} = require("../../controllers/wallet-module/wallet.controller");
const {
  conditionalAuth,
} = require("../../middlewares/authRoles/authorizeRole");
const walletRouter = express.Router();

walletRouter.post("/deduct", conditionalAuth, deductfromUserWallet);
walletRouter.post("/refund", conditionalAuth, refundToUserWallet);
walletRouter.get("/transactions", conditionalAuth, getTransactions);
walletRouter.get("/details", conditionalAuth, getWallet);
walletRouter.get("/details/admin", conditionalAuth, getWalletAdmin);
walletRouter.post("/verify-pin", conditionalAuth, validatePin);
walletRouter.get("/analytics", conditionalAuth, getAnalytics);
walletRouter.post("/send-to-user", conditionalAuth, userInternalTransaction);
walletRouter.get(
  "/transaction-invoice/:transactionId",
  conditionalAuth,
  getTransactionInvoice
);

module.exports = walletRouter;

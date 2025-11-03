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
  getTransactionsSuperAdmin,
  getTransactionInvoice,
} = require("../../controllers/wallet-module/wallet.controller");
const { isUserAuthenticated } = require("../../middlewares/authUser");
const walletRouter = express.Router();

walletRouter.post("/deduct", isUserAuthenticated, deductfromUserWallet);
walletRouter.post("/refund", isUserAuthenticated, refundToUserWallet);
walletRouter.get("/transactions", isUserAuthenticated, getTransactions);
walletRouter.get("/details", isUserAuthenticated, getWallet);
walletRouter.get("/details/admin", isUserAuthenticated, getWalletAdmin);
walletRouter.post("/verify-pin", isUserAuthenticated, validatePin);
walletRouter.get("/analytics", isUserAuthenticated, getAnalytics);
walletRouter.post(
  "/send-to-user",
  isUserAuthenticated,
  userInternalTransaction
);
walletRouter.get(
  "/transaction-invoice/:transactionId",
  isUserAuthenticated,
  getTransactionInvoice
);

module.exports = walletRouter;

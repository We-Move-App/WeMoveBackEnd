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
const walletRouter = express.Router();

walletRouter.post("/deduct", deductfromUserWallet);
walletRouter.post("/refund", refundToUserWallet);
walletRouter.get("/transactions", getTransactions);
walletRouter.get("/details", getWallet);
walletRouter.get("/details/admin", getWalletAdmin);
walletRouter.post("/verify-pin", validatePin);
walletRouter.get("/analytics", getAnalytics);
walletRouter.post("/send-to-user", userInternalTransaction);
walletRouter.get("/transaction-invoice/:transactionId", getTransactionInvoice);

module.exports = walletRouter;

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
  getTransactionsAdmin
} = require("../../controllers/wallet-module/wallet.controller");
const walletRouter = express.Router();

walletRouter.post("/deduct", deductfromUserWallet);
walletRouter.post("/refund", refundToUserWallet);
walletRouter.get("/transactions", getTransactions);
walletRouter.get("/transactions/admin", getTransactionsAdmin);
walletRouter.get("/details", getWallet);
walletRouter.get("/details/admin", getWalletAdmin);
walletRouter.post("/verify-pin", validatePin);
walletRouter.get("/analytics", getAnalytics);
walletRouter.post("/send-to-user", userInternalTransaction);

module.exports = walletRouter;

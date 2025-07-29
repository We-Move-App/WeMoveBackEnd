const express = require("express");
const {
  deductfromUserWallet,
  refundToUserWallet,
  getTransactions,
  getWallet,
  validatePin,
  getAnalytics,
} = require("../../controllers/wallet-module/wallet.controller");
const walletRouter = express.Router();

walletRouter.post("/deduct", deductfromUserWallet);
walletRouter.post("/refund", refundToUserWallet);
walletRouter.get("/transactions", getTransactions);
walletRouter.get("/details", getWallet);
walletRouter.post("/verify-pin", validatePin);
walletRouter.get("/analytics", getAnalytics);

module.exports = walletRouter;

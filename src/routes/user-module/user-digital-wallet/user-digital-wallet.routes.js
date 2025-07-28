// const express = require("express");
// const { isUserAuthenticated } = require("../../../middlewares/authUser");
// const {
//   addWallet,
//   getMyWallet,
//   deleteMyWallet,
//   searchWalletByPhoneNumber,
// } = require("../../../controllers/user-module/user-digital-wallet/user-digital-wallet.controllers");

// const userDigitalWalletRoutes = express.Router();

// userDigitalWalletRoutes
//   .route("/search")
//   .get(isUserAuthenticated, searchWalletByPhoneNumber);

// userDigitalWalletRoutes.route("/add").post(isUserAuthenticated, addWallet);
// userDigitalWalletRoutes
//   .route("/my-wallet")
//   .get(isUserAuthenticated, getMyWallet);
// userDigitalWalletRoutes
//   .route("/delete")
//   .delete(isUserAuthenticated, deleteMyWallet);

// module.exports = userDigitalWalletRoutes;

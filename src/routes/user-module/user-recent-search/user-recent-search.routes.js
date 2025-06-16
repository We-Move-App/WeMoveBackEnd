const express = require("express");
const { isUserAuthenticated } = require("../../../middlewares/authUser");
const {
  getRecentSearch,
  deleteRecentSearches,
} = require("../../../controllers/user-module/user-recent-searches/user-recent-searches.controllers");

const userRecentSearchRoutes = express.Router();

userRecentSearchRoutes.route("/").get(isUserAuthenticated, getRecentSearch);
userRecentSearchRoutes
  .route("/delete/:id")
  .delete(isUserAuthenticated, deleteRecentSearches);

module.exports = userRecentSearchRoutes;

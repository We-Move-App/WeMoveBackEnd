const express = require("express");
const {
  googleSearch,
  googleFirstNameSearch,
} = require("../../../controllers/global-module/google-search/google-search.controller");
const { isUserAuthenticated } = require("../../../middlewares/authUser");

const googleSearchRoutes = express.Router();

googleSearchRoutes.route("/").get(googleSearch);

module.exports = googleSearchRoutes;

const express = require("express");
const { userGoogleSearch } = require("../../../controllers/user-module/user-google-search/user-google-search");
const statusCode = require("../../../utils/constants/statusCode");
const { isUserAuthenticated } = require("../../../middlewares/authUser");
const usersearchroutes = express.Router();

usersearchroutes.route("/").get(isUserAuthenticated, userGoogleSearch);


module.exports = usersearchroutes;

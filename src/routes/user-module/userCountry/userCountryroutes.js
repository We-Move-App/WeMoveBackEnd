
const express = require("express");

const { getCountries } = require("../../../controllers/user-module/userCountry/userCountry.Controllers");   
const {isUserAuthenticated} = require("../../../middlewares/authUser");
const userCountryRoutes = express.Router();


// Correct way: chaining with dot on same line or just separate
userCountryRoutes
    .route("/getNationality")
    .get(isUserAuthenticated, getCountries);

module.exports = { userCountryRoutes };

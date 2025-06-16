

const express = require('express')
//const { isAdminAuthenticated  } = require("../../../middlewares/authAdmins");
const { getAmenities, addAmenity, deleteAmenity, updateAmenity } = require("../../../controllers/global-module/Amenities/amenities.controller");

const amenititesRoutes = express.Router()

amenititesRoutes.route("/").get( getAmenities)
amenititesRoutes.route("/").post( addAmenity)
amenititesRoutes.route("/:id").delete( deleteAmenity)
amenititesRoutes.route("/:id").put( updateAmenity)



module.exports = amenititesRoutes
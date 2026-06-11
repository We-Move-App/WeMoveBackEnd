

const express = require('express')
//const { isAdminAuthenticated  } = require("../../../middlewares/authAdmins");
const { getAmenities, addAmenity, deleteAmenity, updateAmenity } = require("../../../controllers/global-module/Amenities/amenities.controller");
const { uploadAmenityImages } = require("../../../utils/uploadFiles/multer");



const amenititesRoutes = express.Router()

amenititesRoutes.route("/").get(getAmenities)
amenititesRoutes.route("/").post(uploadAmenityImages, addAmenity)
amenititesRoutes.route("/:id").delete(deleteAmenity)
amenititesRoutes.route("/:id").put( uploadAmenityImages,updateAmenity)



module.exports = amenititesRoutes
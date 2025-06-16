const express = require("express");

const { uploadDocuments } = require("../../../utils/uploadFiles/multer");
const {
  getBankDetails,
  createBankDetails,
  updateBankDetails,
  deleteBankDetails,
} = require("../../../controllers/driver-module/driver-banks/driver-banks.controllers");
const { isDriverAuthenticated } = require("../../../middlewares/authDriver");

const driverBankRoutes = express.Router();

driverBankRoutes.route("/").get(isDriverAuthenticated, getBankDetails);
driverBankRoutes
  .route("/")
  .post(isDriverAuthenticated, uploadDocuments, createBankDetails);
driverBankRoutes.route("/:id").put(isDriverAuthenticated,uploadDocuments, updateBankDetails);
driverBankRoutes.route("/:id").delete(isDriverAuthenticated, deleteBankDetails);

module.exports = driverBankRoutes;

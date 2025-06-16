const express = require("express");

const { uploadDocuments } = require("../../../utils/uploadFiles/multer");
const {
  getBankDetails,
  createBankDetails,
  updateBankDetails,
  deleteBankDetails,
} = require("../../../controllers/bus-module/bus-operator-banks/bus-operator-banks.controllers");
const { isBusOperatorAuthenticated } = require("../../../middlewares/authBusOperator");

const BusOperatorBankRoutes= express.Router();

BusOperatorBankRoutes.route("/").get(isBusOperatorAuthenticated, getBankDetails);
BusOperatorBankRoutes
  .route("/")
  .post(isBusOperatorAuthenticated, uploadDocuments, createBankDetails);
BusOperatorBankRoutes.route("/:id").put(isBusOperatorAuthenticated,uploadDocuments, updateBankDetails);
BusOperatorBankRoutes.route("/:id").delete(isBusOperatorAuthenticated, deleteBankDetails);

module.exports = BusOperatorBankRoutes;

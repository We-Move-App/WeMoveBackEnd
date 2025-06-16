const express = require("express");

const { uploadDocuments } = require("../../../utils/uploadFiles/multer");
const {
  getBankDetails,
  createBankDetails,
  updateBankDetails,
  deleteBankDetails,
} = require("../../../controllers/hotel-module/hotel-manager-bank/hotel-manager-bank.controller");
const { isHotelManagerAuthenticated } = require("../../../middlewares/authHotelManager");
const logger = require("../../../utils/logger/logger");

const HotelManagerBankRoutes = express.Router();

HotelManagerBankRoutes.route("/")
  .get(isHotelManagerAuthenticated, getBankDetails)
  .post(isHotelManagerAuthenticated, uploadDocuments, createBankDetails);

HotelManagerBankRoutes.route("/:id")
  .put(isHotelManagerAuthenticated, uploadDocuments, updateBankDetails)
  .delete(isHotelManagerAuthenticated, deleteBankDetails);

module.exports = HotelManagerBankRoutes;

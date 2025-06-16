const express = require("express");

const { uploadDocuments } = require("../../../utils/uploadFiles/multer");
const { isUserAuthenticated } = require("../../../middlewares/authUser");
const {
  getBankDetails,
  createBankDetails,
  updateBankDetails,
  deleteBankDetails,
} = require("../../../controllers/user-module/user-banks/user-banks.controllers");

const userBankRoutes = express.Router();

userBankRoutes.route("/").get(isUserAuthenticated, getBankDetails);
userBankRoutes
  .route("/")
  .post(isUserAuthenticated, uploadDocuments, createBankDetails);
userBankRoutes.route("/:id").put(isUserAuthenticated,uploadDocuments, updateBankDetails);
userBankRoutes.route("/:id").delete(isUserAuthenticated, deleteBankDetails);

module.exports = userBankRoutes;

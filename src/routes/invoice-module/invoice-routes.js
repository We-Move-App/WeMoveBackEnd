const express = require("express");
const {
  getHotelInvoice,
  getTransactionReceipt,
} = require("../../controllers/invoice-module/invoice-controller");
const { getBusInvoice } = require("../../utils/services/invoice.service");
const { isUserAuthenticated } = require("../../middlewares/authUser");
const invoiceRouter = express.Router();

invoiceRouter.get("/bus-booking/:bookingId", getBusInvoice);
invoiceRouter.get(
  "/hotel-booking/:bookingId",
  isUserAuthenticated,
  getHotelInvoice
);
invoiceRouter.get("/transaction/:transactionId", getTransactionReceipt);

module.exports = invoiceRouter;

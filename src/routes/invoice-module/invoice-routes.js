const express = require("express");
const {
  getHotelInvoice,
  getTransactionReceipt,
} = require("../../controllers/invoice-module/invoice-controller");
const {
  getBusInvoice,
  getTransactionInvoice,
} = require("../../utils/services/invoice.service");
const invoiceRouter = express.Router();

invoiceRouter.get("/bus-booking/:bookingId", getBusInvoice);
invoiceRouter.get("/hotel-booking/:bookingId", getHotelInvoice);
invoiceRouter.get("/transaction/:transactionId", getTransactionReceipt);

module.exports = invoiceRouter;

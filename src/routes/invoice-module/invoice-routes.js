const express = require("express");
const {
  getBusInvoice,
  getHotelInvoice,
  getTransactionInvoice,
} = require("../../utils/services/invoice.service");
const invoiceRouter = express.Router();

invoiceRouter.get("/bus-booking/:bookingId", getBusInvoice);
invoiceRouter.get("/hotel-booking/:bookingId", getHotelInvoice);
invoiceRouter.get("/transaction/:transactionId", getTransactionInvoice);

module.exports = invoiceRouter;

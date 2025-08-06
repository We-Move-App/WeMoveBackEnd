const express = require("express");
const {
  getBusInvoice,
  getHotelInvoice,
} = require("../../utils/services/invoice.service");
const invoiceRouter = express.Router();

invoiceRouter.get("/bus-booking/:bookingId", getBusInvoice);
invoiceRouter.get("/hotel-booking/:bookingId", getHotelInvoice);

module.exports = invoiceRouter;

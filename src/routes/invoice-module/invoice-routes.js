const express = require("express");
const { getInvoice } = require("../../utils/services/invoice.service");
const invoiceRouter = express.Router();

invoiceRouter.get("/bus-booking/:bookingId", getInvoice);

module.exports = invoiceRouter;

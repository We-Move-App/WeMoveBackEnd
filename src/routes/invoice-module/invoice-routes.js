const express = require("express");
const { getInvoice } = require("../../utils/services/invoice.service");
const invoiceRouter = express.Router();

invoiceRouter.post("/bus-booking", getInvoice);

module.exports = invoiceRouter;

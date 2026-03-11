const HotelBookingModel = require("../../models/hotel-module/hotel-bookings/hotel-bookings.model");
const TransactionModel = require("../../models/transaction-module/transaction.model");
const statusCode = require("../../utils/constants/statusCode");
const ApiError = require("../../utils/response/ApiError");
const ApiResponse = require("../../utils/response/ApiResponse");
const catchAsyncError = require("../../utils/response/catchAsyncError");
const { fetchLn } = require("../../utils/services/user.services");
const {
  generateHotelInvoiceBase64,
  generateTransactionReceiptBase64,
} = require("./base64-service");

const getHotelInvoice = catchAsyncError(async (req, res, next) => {
  const { bookingId } = req.params;

  const userId = req.user._id;
  const ln = await fetchLn(userId); // "en" or "fr"

  const booking = await HotelBookingModel.findById(bookingId).populate(
    "hotelId",
    "hotelName"
  );

  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }

  const base64Pdf = await generateHotelInvoiceBase64(booking, ln);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        base64Pdf,
        "Invoice generated successfully"
      )
    );
});

const getTransactionReceipt = catchAsyncError(async (req, res) => {
  const { transactionId } = req.params;

  // New model: no userId / hotelManagerId / busOperatorId fields to populate.
  // We just fetch the ledger transaction and use meta + entries to render receipt.
  const txn = await TransactionModel.findOne({ transactionId }).lean();

  if (!txn) {
    throw new ApiError(statusCode.NOT_FOUND, "Transaction not found");
  }

  const base64Pdf = await generateTransactionReceiptBase64(txn);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        base64Pdf,
        "Receipt generated successfully"
      )
    );
});

module.exports = { getHotelInvoice, getTransactionReceipt };

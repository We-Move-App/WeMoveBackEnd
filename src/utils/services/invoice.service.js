const fs = require("fs/promises");
const path = require("path");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const BusBookingModel = require("../../models/bus-module/bus-bookings/bus-bookings.model");
const catchAsyncError = require("../response/catchAsyncError");
const ApiError = require("../response/ApiError");
const ApiResponse = require("../response/ApiResponse");
const statusCode = require("../constants/statusCode");


const getInvoice = catchAsyncError(async (req, res, next) => {
  const { bookingId } = req.params;

  const booking = await BusBookingModel.findById(bookingId).populate("passengers");

  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }

  const base64Pdf = await generateBookingInvoiceBase64(booking);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        base64Pdf ,
        "Invoice generated successfully"
      )
    );
});

const generateBookingInvoiceBase64 = async (booking) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { height } = page.getSize();

  let y = height - 50;

  page.drawText("Booking Invoice", {
    x: 200,
    y,
    size: 22,
    font,
    color: rgb(0, 0, 0),
  });

  y -= 50;

  page.drawText(`Booking ID: ${booking._id}`, { x: 50, y, size: 12, font });
  y -= 20;
  page.drawText(`From: ${booking.from}`, { x: 50, y, size: 12, font });
  y -= 20;
  page.drawText(`To: ${booking.to}`, { x: 50, y, size: 12, font });
  y -= 20;
  page.drawText(`Journey Date: ${new Date(booking.journeyDate).toLocaleDateString()}`, {
    x: 50,
    y,
    size: 12,
    font,
  });
  y -= 20;
  page.drawText(`Booking By: ${booking.bookingBy}`, { x: 50, y, size: 12, font });
  y -= 20;
  page.drawText(`Status: ${booking.status}`, { x: 50, y, size: 12, font });
  y -= 20;
  page.drawText(`No of Passengers: ${booking.noOfPassengers}`, { x: 50, y, size: 12, font });
  y -= 20;
  page.drawText(`Price: ${booking.price} XAF`, { x: 50, y, size: 12, font });
  y -= 20;
  page.drawText(`Payment Status: ${booking.paymentStatus}`, { x: 50, y, size: 12, font });
  y -= 40;

  page.drawText("Passengers:", { x: 50, y, size: 14, font, color: rgb(0, 0, 0) });
  y -= 25;

  booking.passengers.forEach((p, idx) => {
    page.drawText(`${idx + 1}. ${p.name}`, { x: 70, y, size: 12, font });
    y -= 20;
    page.drawText(`   Seat: ${p.seatNumber}`, { x: 70, y, size: 12, font });
    y -= 20;
    page.drawText(`   Email: ${p.email}`, { x: 70, y, size: 12, font });
    y -= 20;
    page.drawText(`   Contact: ${p.contactNumber}`, { x: 70, y, size: 12, font });
    y -= 30;
  });

  page.drawText(`Created At: ${new Date(booking.createdAt).toLocaleString()}`, {
    x: 50,
    y,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString("base64");
};

module.exports = { getInvoice };

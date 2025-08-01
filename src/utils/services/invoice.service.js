const fs = require("fs/promises");
const path = require("path");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

const generateBookingInvoiceBase64 = async (booking) => {
  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { height } = page.getSize();

  let y = height - 50;

  // Title
  page.drawText("Booking Invoice", {
    x: 200,
    y,
    size: 22,
    font,
    color: rgb(0, 0, 0),
  });

  y -= 50;

  // Booking details
  page.drawText(`Booking ID: ${booking.bookingId}`, { x: 50, y, size: 12, font });
  y -= 20;
  page.drawText(`From: ${booking.from}`, { x: 50, y, size: 12, font });
  y -= 20;
  page.drawText(`To: ${booking.to}`, { x: 50, y, size: 12, font });
  y -= 20;
  page.drawText(
    `Journey Date: ${new Date(booking.journeyDate).toLocaleDateString()}`,
    { x: 50, y, size: 12, font }
  );
  y -= 20;
  page.drawText(`Booking By: ${booking.bookingBy}`, { x: 50, y, size: 12, font });
  y -= 20;
  page.drawText(`Status: ${booking.status}`, { x: 50, y, size: 12, font });
  y -= 20;
  page.drawText(`No of Passengers: ${booking.noOfPassengers}`, {
    x: 50,
    y,
    size: 12,
    font,
  });
  y -= 20;
  page.drawText(`Price: ${booking.price} XAF`, { x: 50, y, size: 12, font });
  y -= 20;
  page.drawText(`Payment Status: ${booking.paymentStatus}`, {
    x: 50,
    y,
    size: 12,
    font,
  });
  y -= 40;

  // Passenger table header
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

  // Footer
  page.drawText(`Created At: ${new Date(booking.createdAt).toLocaleString()}`, {
    x: 50,
    y,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Generate Base64 PDF
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString("base64");
};

const getInvoice = async (req, res) => {
  const booking = req.body; 

  try {
    const base64Pdf = await generateBookingInvoiceBase64(booking);

    return res.status(200).json({
      success: true,
      message: "Invoice generated successfully",
      pdfBase64: base64Pdf,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { generateBookingInvoiceBase64,getInvoice };

const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const BusBookingModel = require("../../models/bus-module/bus-bookings/bus-bookings.model");
const catchAsyncError = require("../response/catchAsyncError");
const ApiError = require("../response/ApiError");
const ApiResponse = require("../response/ApiResponse");
const statusCode = require("../constants/statusCode");
const HotelBookingModel = require("../../models/hotel-module/hotel-bookings/hotel-bookings.model");

const getBusInvoice = catchAsyncError(async (req, res, next) => {
  const { bookingId } = req.params;

  const booking =
    await BusBookingModel.findById(bookingId).populate("passengers");

  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }

  const base64Pdf = await generateBusBookingInvoiceBase64(booking);

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

const getHotelInvoice = catchAsyncError(async (req, res, next) => {
  const { bookingId } = req.params;

  const booking = await HotelBookingModel.findById(bookingId).populate(
    "hotelId",
    "hotelName"
  );

  if (!booking) {
    throw new ApiError(statusCode.NOT_FOUND, "Booking not found");
  }

  const base64Pdf = await generateHotelBookingInvoiceBase64(booking);

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

const generateBusBookingInvoiceBase64 = async (booking) => {
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
  page.drawText(
    `Journey Date: ${new Date(booking.journeyDate).toLocaleDateString()}`,
    {
      x: 50,
      y,
      size: 12,
      font,
    }
  );
  y -= 20;
  page.drawText(`Booking By: ${booking.bookingBy}`, {
    x: 50,
    y,
    size: 12,
    font,
  });
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
  page.drawText(`Price: ${booking.price} ${process.env.MOMO_CURRENCY}`, {
    x: 50,
    y,
    size: 12,
    font,
  });
  y -= 20;
  page.drawText(`Payment Status: ${booking.paymentStatus}`, {
    x: 50,
    y,
    size: 12,
    font,
  });
  y -= 40;

  page.drawText("Passengers:", {
    x: 50,
    y,
    size: 14,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 25;

  booking.passengers.forEach((p, idx) => {
    page.drawText(`${idx + 1}. ${p.name}`, { x: 70, y, size: 12, font });
    y -= 20;
    page.drawText(`   Seat: ${p.seatNumber}`, { x: 70, y, size: 12, font });
    y -= 20;
    page.drawText(`   Email: ${p.email}`, { x: 70, y, size: 12, font });
    y -= 20;
    page.drawText(`   Contact: ${p.contactNumber}`, {
      x: 70,
      y,
      size: 12,
      font,
    });
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

const generateHotelBookingInvoiceBase64 = async (booking) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { height, width } = page.getSize();

  let y = height - 60;

  // Header Box
  page.drawRectangle({
    x: 0,
    y: y - 40,
    width: width,
    height: 70,
    color: rgb(0.2, 0.5, 0.8),
  });

  page.drawText("HOTEL BOOKING INVOICE", {
    x: 180,
    y: y,
    size: 22,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  y -= 100;

  // Booking Details Section
  page.drawText("Booking Details", {
    x: 50,
    y,
    size: 16,
    font: boldFont,
    color: rgb(0.1, 0.3, 0.6),
  });
  y -= 25;

  const details = [
    ["Booking ID", booking._id],
    ["Hotel", booking.hotelId?.hotelName || "N/A"],
    [
      "Check-In",
      `${new Date(booking.checkInDate).toLocaleDateString()} ${new Date(
        booking.checkInTime
      ).toLocaleTimeString()}`,
    ],
    [
      "Check-Out",
      `${new Date(booking.checkOutDate).toLocaleDateString()} ${new Date(
        booking.checkOutTime
      ).toLocaleTimeString()}`,
    ],
    ["Booking By", booking.bookingBy],
    ["Status", booking.status],
    ["No of Rooms", booking.noOfRoom],
    ["Guests", `${booking.noOfAdults} Adults, ${booking.noOfKids} Kids`],
    ["Total Amount", `${booking.totalAmount} ${process.env.MOMO_CURRENCY}`],
    ["Payment Status", booking.paymentStatus],
  ];

  details.forEach(([label, value]) => {
    page.drawText(`${label}:`, {
      x: 60,
      y,
      size: 12,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(`${value}`, {
      x: 200,
      y,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
    y -= 20;
  });

  y -= 20;

  // Guest Details Section
  page.drawText("Guest Details", {
    x: 50,
    y,
    size: 16,
    font: boldFont,
    color: rgb(0.1, 0.3, 0.6),
  });
  y -= 25;

  booking.user.forEach((p, idx) => {
    page.drawRectangle({
      x: 45,
      y: y - 5,
      width: width - 90,
      height: 80,
      borderColor: rgb(0.2, 0.5, 0.8),
      borderWidth: 1,
      color: rgb(0.95, 0.95, 1),
    });

    page.drawText(`${idx + 1}. ${p.name}`, {
      x: 60,
      y: y + 60,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    page.drawText(`Age: ${p.age || "N/A"}, Gender: ${p.gender || "N/A"}`, {
      x: 200,
      y: y + 60,
      size: 12,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    let guestY = y + 40;
    if (p.email) {
      page.drawText(`Email: ${p.email}`, { x: 60, y: guestY, size: 12, font });
      guestY -= 20;
    }
    if (p.phoneNumber) {
      page.drawText(`Phone: ${p.phoneNumber}`, {
        x: 60,
        y: guestY,
        size: 12,
        font,
      });
      guestY -= 20;
    }
    if (p.roomsNumber) {
      page.drawText(`Room No: ${p.roomsNumber}`, {
        x: 60,
        y: guestY,
        size: 12,
        font,
      });
      guestY -= 20;
    }
    if (p.identityCard?.fileUrl) {
      page.drawText(`ID Proof: ${p.identityCard.fileUrl}`, {
        x: 60,
        y: guestY,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
    y -= 100;
  });

  // Footer
  page.drawLine({
    start: { x: 50, y: 60 },
    end: { x: width - 50, y: 60 },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });

  page.drawText(`Invoice generated on: ${new Date().toLocaleString()}`, {
    x: 50,
    y: 40,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString("base64");
};

function sanitizeText(text) {
  if (!text) return "";
  return text.replace(/→/g, "->");
}

function sanitizeText(text) {
  if (!text) return "";
  return text.replace(/→/g, "->");
}

async function generateTransactionPDFBase64(transaction) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { height } = page.getSize();

  let y = height - 50;

  // Dynamic heading
  let heading = "Transaction Receipt";
  const desc = transaction.description?.toLowerCase() || "";

  if (desc.startsWith("bus booking")) heading = "Bus Booking";
  else if (desc.startsWith("hotel booking")) heading = "Hotel Booking";
  else if (desc.startsWith("bike ride from")) heading = "Bike Ride";
  else if (desc.startsWith("taxi ride from")) heading = "Taxi Booking";
  else if (desc.startsWith("sent to")) heading = "Internal Wallet Transaction";
  else if (desc.startsWith("received from"))
    heading = "Internal Wallet Transaction";
  else if (desc.startsWith("wallet top-up")) heading = "Wallet Top-up";

  // Heading
  page.drawText(heading, {
    x: 200,
    y,
    size: 20,
    font,
    color: rgb(0, 0, 0),
  });
  y -= 50;

  // Transaction ID
  page.drawText(`Transaction ID: ${transaction.transactionId}`, {
    x: 50,
    y,
    size: 12,
    font,
  });
  y -= 20;

  // Purpose (auto-wrap long text)
  const purposeText = `Purpose: ${sanitizeText(transaction.description)}`;
  page.drawText(purposeText, {
    x: 50,
    y,
    size: 12,
    font,
    maxWidth: 500,
    lineHeight: 16,
  });
  const purposeLines = Math.ceil(font.widthOfTextAtSize(purposeText, 12) / 500);
  y -= purposeLines * 16;

  // Date & Time
  page.drawText(
    `Date & Time: ${new Date(transaction.createdAt).toLocaleString()}`,
    { x: 50, y, size: 12, font }
  );
  y -= 40;

  // Transaction details
  page.drawText(`Amount: ${transaction.amount} ${transaction.currency}`, {
    x: 50,
    y,
    size: 12,
    font,
  });
  y -= 20;

  page.drawText(`Status: ${transaction.status}`, { x: 50, y, size: 12, font });
  y -= 20;

  page.drawText(`Type: ${transaction.type}`, { x: 50, y, size: 12, font });
  y -= 20;

  page.drawText(`Booking ID: ${transaction.bookingId || "-"}`, {
    x: 50,
    y,
    size: 12,
    font,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString("base64");
}

module.exports = {
  getBusInvoice,
  getHotelInvoice,
  generateTransactionPDFBase64,
};

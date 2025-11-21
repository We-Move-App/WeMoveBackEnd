const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const BusBookingModel = require("../../models/bus-module/bus-bookings/bus-bookings.model");
const catchAsyncError = require("../response/catchAsyncError");
const ApiError = require("../response/ApiError");
const ApiResponse = require("../response/ApiResponse");
const statusCode = require("../constants/statusCode");
const HotelBookingModel = require("../../models/hotel-module/hotel-bookings/hotel-bookings.model");
const QRCode = require("qrcode");
const Transaction = require("../../models/transaction-module/transaction.model");
const { createCanvas } = require("canvas");

const formatAmount = (amount) =>
  Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDateTime = (date) => {
  const d = new Date(date);
  const datePart = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }); // e.g. 20 Feb 2025
  const timePart = d.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  }); // e.g. 7:09 pm
  return `${datePart}, ${timePart}`;
};

const generateTransactionReceiptBase64 = async (tx) => {
  // --- PDF SETUP ---
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([358, 752]); // same as canvas size

  const width = 358;
  const height = 752;

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // COLORS
  const bgGrey = rgb(0.23, 0.23, 0.23);
  const white = rgb(1, 1, 1);
  const successGreen = rgb(0.117, 0.427, 0.298);
  const failRed = rgb(0.84, 0.27, 0.27);

  const textDark = rgb(0.07, 0.07, 0.07);
  const mutedText = rgb(0.47, 0.47, 0.47);
  const divider = rgb(0.89, 0.89, 0.89);

  // --- BACKGROUND ---
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: bgGrey,
  });

  // --- WHITE CARD ---
  const cardPadding = 14;
  const cardX = cardPadding;
  const cardY = cardPadding;
  const cardW = width - cardPadding * 2;
  const cardH = height - cardPadding * 2;

  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardW,
    height: cardH,
    color: white,
  });

  // Status
  const isSuccess = tx.status === "SUCCESS" || tx.status === "COMPLETED";
  const mainColor = isSuccess ? successGreen : failRed;
  const statusText = isSuccess
    ? "Transaction Successful"
    : "Transaction Failed";

  // --- TOP ICON CIRCLE ---
  const centerX = width / 2;
  let currentY = height - (cardY + 60); // in PDF y=bottom, so reverse

  page.drawCircle({
    x: centerX,
    y: currentY,
    size: 34,
    color: mainColor,
  });

  // Draw check or cross (simple lines)
  const drawLine = (x1, y1, x2, y2) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 4,
      color: white,
    });
  };

  if (isSuccess) {
    // ✓
    drawLine(centerX - 12, currentY, centerX - 2, currentY - 12);
    drawLine(centerX - 2, currentY - 12, centerX + 16, currentY + 10);
  } else {
    // ✕
    drawLine(centerX - 15, currentY + 15, centerX + 15, currentY - 15);
    drawLine(centerX + 15, currentY + 15, centerX - 15, currentY - 15);
  }

  // --- TITLE ---
  currentY -= 60;
  page.drawText(statusText, {
    x: centerX - helveticaBold.widthOfTextAtSize(statusText, 14) / 2,
    y: currentY,
    size: 14,
    font: helveticaBold,
    color: mainColor,
  });

  // --- PAID / RECEIVED ---
  currentY -= 28;
  const actionText = tx.type === "CREDIT" ? "Received" : "Paid";
  page.drawText(actionText, {
    x: centerX - helveticaBold.widthOfTextAtSize(actionText, 20) / 2,
    y: currentY,
    size: 20,
    font: helveticaBold,
    color: textDark,
  });

  // Amount
  currentY -= 26;
  const amountText = `${formatAmount(tx.amount)} ${tx.currency || ""}`.trim();
  page.drawText(amountText, {
    x: centerX - helveticaBold.widthOfTextAtSize(amountText, 22) / 2,
    y: currentY,
    size: 22,
    font: helveticaBold,
    color: textDark,
  });

  // --- COMMISSION ---
  currentY -= 30;
  if (tx.platformFee && Number(tx.platformFee) > 0) {
    const commText = `*Commission deducted ${formatAmount(
      tx.platformFee
    )} ${tx.currency || ""}`.trim();

    page.drawText(commText, {
      x: centerX - helvetica.widthOfTextAtSize(commText, 12) / 2,
      y: currentY,
      size: 12,
      font: helvetica,
      color: mutedText,
    });

    currentY -= 24;
  }

  // DATE
  const dateTime = formatDateTime(tx.createdAt || tx.updatedAt || new Date());
  page.drawText(dateTime, {
    x: centerX - helvetica.widthOfTextAtSize(dateTime, 12) / 2,
    y: currentY,
    size: 12,
    font: helvetica,
    color: mutedText,
  });

  // --- DETAILS CARD ---
  const detailsTopY = currentY - 56;
  const detailsX = cardX + 18;
  const detailsW = cardW - 36;
  const detailsH = 250;

  page.drawRectangle({
    x: detailsX,
    y: detailsTopY - detailsH,
    width: detailsW,
    height: detailsH,
    color: rgb(0.98, 0.98, 0.98),
  });

  const innerPadX = 18;
  let y = detailsTopY - 28;
  const lineGap = 22;

  const metaFrom = (tx.meta && tx.meta.from) || {};
  const metaTo = (tx.meta && tx.meta.to) || {};

  const drawRow = (label, value) => {
    // Label
    page.drawText(label, {
      x: detailsX + innerPadX,
      y,
      size: 12,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    y -= 18;

    // Value
    page.drawText(value || "-", {
      x: detailsX + innerPadX,
      y,
      size: 12,
      font: helvetica,
      color: rgb(0.29, 0.29, 0.29),
    });

    y -= lineGap;

    // Divider line
    page.drawLine({
      start: { x: detailsX, y: y + 6 },
      end: { x: detailsX + detailsW, y: y + 6 },
      thickness: 1,
      color: divider,
    });
  };

  drawRow(`To ${metaTo.name || ""}`.trim(), `ID: ${metaTo.id || "-"}`);
  drawRow(`From ${metaFrom.name || ""}`.trim(), `ID: ${metaFrom.id || "-"}`);
  drawRow("Transaction ID", tx.transactionId || String(tx._id || "-"));
  drawRow("Transaction Type", tx.transactionType || "Transaction");

  // EXPORT PDF → Base64
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes).toString("base64");
};

// Utility to draw rounded rectangles
function roundedRect(ctx, x, y, w, h, r) {
  const radius = typeof r === "number" ? { tl: r, tr: r, br: r, bl: r } : r;
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + w - radius.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius.tr);
  ctx.lineTo(x + w, y + h - radius.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius.br, y + h);
  ctx.lineTo(x + radius.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
}

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

const getTransactionInvoice = catchAsyncError(async (req, res, next) => {
  const { transactionId } = req.params;

  const tx = await Transaction.findOne({ transactionId });
  if (!tx) throw new ApiError(statusCode.NOT_FOUND, "Transaction not found");

  const base64Png = await generateTransactionReceiptBase64(tx);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        base64Png,
        "Receipt generated successfully"
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

const LINE = 24;
const GAP = 6;

const fmtDate = (d) =>
  d
    ? new Date(d)
        .toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        .toUpperCase()
    : "-";

const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString(undefined, { hour12: false }) : "-";

const drawLabelValue = (page, { x, y, label, value, font, size = 14 }) => {
  page.drawText(`${label} :`, { x, y, size, font, color: rgb(0, 0, 0) });
  page.drawText(String(value ?? "-"), {
    x: x + 80, // more room so values never touch the label
    y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
  return y - (LINE + GAP);
};

/* ---------- main ---------- */
const generateBusBookingInvoiceBase64 = async (booking) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([900, 520]); // wide ticket style
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();

  // Colors close to the reference
  const orange = rgb(0.95, 0.6, 0.1);
  const green = rgb(0.08, 0.38, 0.31);
  const dark = rgb(0.1, 0.1, 0.1);

  // Outer border
  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderColor: dark,
    borderWidth: 1,
  });

  // Geometry
  const BORDER_X = 30,
    BORDER_Y = 30;
  const BORDER_W = width - 60,
    BORDER_H = height - 60;
  const TOP_H = 60; // taller header to avoid crowding
  const FOOT_H = 48; // taller footer for bigger font

  // Top banner (orange)
  page.drawRectangle({
    x: BORDER_X,
    y: BORDER_Y + BORDER_H - TOP_H,
    width: BORDER_W,
    height: TOP_H,
    color: orange,
    borderColor: dark,
    borderWidth: 1,
  });

  // Company (left)
  page.drawText(booking.companyName || "WemoveAll", {
    x: BORDER_X + 18,
    y: BORDER_Y + BORDER_H - TOP_H + 18,
    size: 18,
    font: bold,
    color: rgb(0, 0.3, 0.2),
  });

  // Right green block
  const rightBannerWidth = 200;
  page.drawRectangle({
    x: BORDER_X + BORDER_W - rightBannerWidth,
    y: BORDER_Y + BORDER_H - TOP_H,
    width: rightBannerWidth,
    height: TOP_H,
    color: green,
    borderColor: dark,
    borderWidth: 1,
  });

  // // Center ticket no
  // const ticketNo = String(booking?.ticketNo || booking?._id || "")
  //   .toString()
  //   .slice(-6);
  // page.drawText(`Ticket No. ${ticketNo}`, {
  //   x: BORDER_X + BORDER_W / 2 - 80,
  //   y: BORDER_Y + BORDER_H - TOP_H + 20,
  //   size: 13,
  //   font,
  //   color: rgb(0, 0, 0),
  // });

  // Right "BUS TICKET"
  page.drawText("BUS TICKET", {
    x: BORDER_X + BORDER_W - rightBannerWidth + 18,
    y: BORDER_Y + BORDER_H - TOP_H + 18,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });

  // Main content area
  const contentTopY = BORDER_Y + BORDER_H - TOP_H - 30; // generous padding below header
  const contentLeftX = BORDER_X + 18;

  // 3 equal columns
  const colW = (BORDER_W - 36) / 3;
  const col1X = contentLeftX;
  const col2X = contentLeftX + colW;
  const col3X = contentLeftX + 2 * colW;

  /* -------- LEFT COLUMN -------- */
  let y1 = contentTopY;

  const firstPassenger = booking?.passengers?.[0];
  y1 = drawLabelValue(page, {
    x: col1X,
    y: y1,
    label: "Name",
    value: firstPassenger?.name || booking?.bookingBy || "-",
    font,
  });

  const jDate = fmtDate(booking?.journeyDate || booking?.createdAt);
  const jTime = fmtTime(booking?.journeyDate || booking?.createdAt);
  y1 = drawLabelValue(page, {
    x: col1X,
    y: y1,
    label: "Date",
    value: jDate,
    font,
  });
  y1 = drawLabelValue(page, {
    x: col1X,
    y: y1,
    label: "Time",
    value: jTime,
    font,
  });

  const busReg =
    booking?.bus?.regNumber || booking?.busRegNumber || booking?.bus || "-";
  y1 = drawLabelValue(page, {
    x: col1X,
    y: y1,
    label: "Bus",
    value: busReg,
    font,
  });

  const stationLeft =
    booking?.station || booking?.from || booking?.route?.startLocation || "-";
  y1 = drawLabelValue(page, {
    x: col1X,
    y: y1,
    label: "Station",
    value: stationLeft,
    font,
  });

  const seatText =
    (booking?.passengers || [])
      .map((p) => p?.seatNumber)
      .filter(Boolean)
      .join(", ") || "-";
  y1 = drawLabelValue(page, {
    x: col1X,
    y: y1,
    label: "Seat",
    value: seatText,
    font,
  });

  /* -------- MIDDLE COLUMN (From/To + QR) -------- */
  let y2 = contentTopY;

  page.drawText(
    `From: ${booking?.from || booking?.route?.startLocation || "-"}`,
    { x: col2X, y: y2, size: 14, font }
  );
  y2 -= LINE;
  page.drawText(`To:   ${booking?.to || booking?.route?.endLocation || "-"}`, {
    x: col2X,
    y: y2,
    size: 14,
    font,
  });
  y2 -= LINE / 2;

  // QR code (booking._id)
  const qrPng = await QRCode.toBuffer(String(booking?._id || ""), {
    errorCorrectionLevel: "M",
    width: 200,
    margin: 1,
  });
  const qrImg = await pdfDoc.embedPng(qrPng);

  // Compute a safe Y so it never hits the footer
  let qrSize = 170; // visual size on PDF
  const qrTopGap = 10;
  const minBottomGap = FOOT_H + 40; // keep QR well above footer
  let qrY = y2 - qrTopGap - qrSize;

  if (qrY < BORDER_Y + minBottomGap) {
    // shift up (or slightly reduce) to preserve bottom clearance
    const deficit = BORDER_Y + minBottomGap - qrY;
    qrY += deficit;
    if (qrY + qrSize > contentTopY - 2 * LINE) {
      // In a very tight scenario, shrink QR a bit
      const maxSize =
        contentTopY - 2 * LINE - (BORDER_Y + minBottomGap) - qrTopGap;
      if (maxSize > 120) qrSize = Math.min(qrSize, maxSize);
    }
  }

  page.drawImage(qrImg, {
    x: col2X + (colW - qrSize) / 2,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  page.drawText("Scan To Validate Ticket", {
    x: col2X + colW / 2 - 70,
    y: qrY - 16,
    size: 11,
    font,
    color: rgb(0.25, 0.25, 0.25),
  });

  /* -------- RIGHT COLUMN -------- */
  let y3 = contentTopY;

  const departStation =
    booking?.departureAddress ||
    booking?.from ||
    booking?.route?.startLocation ||
    "-";
  y3 = drawLabelValue(page, {
    x: col3X,
    y: y3,
    label: "Station",
    value: departStation,
    font,
  });

  const arrDate = fmtDate(booking?.arrivalDate || booking?.journeyDate);
  const arrTime = fmtTime(booking?.arrivalTime || booking?.journeyDate);
  y3 = drawLabelValue(page, {
    x: col3X,
    y: y3,
    label: "Date",
    value: arrDate,
    font,
  });
  y3 = drawLabelValue(page, {
    x: col3X,
    y: y3,
    label: "Time",
    value: arrTime,
    font,
  });

  const currency = process.env.MOMO_CURRENCY || "";
  y3 = drawLabelValue(page, {
    x: col3X,
    y: y3,
    label: "Price",
    value: `${booking?.price ?? "-"} ${currency}`.trim(),
    font,
  });

  const arrStation = booking?.to || booking?.route?.endLocation || "-";
  y3 = drawLabelValue(page, {
    x: col3X,
    y: y3,
    label: "Station",
    value: arrStation,
    font,
  });

  const klass = booking?.class || "Regular";
  y3 = drawLabelValue(page, {
    x: col3X,
    y: y3,
    label: "Class",
    value: klass,
    font,
  });

  // Footer
  page.drawRectangle({
    x: BORDER_X,
    y: BORDER_Y,
    width: BORDER_W,
    height: FOOT_H,
    color: green,
    borderColor: dark,
    borderWidth: 1,
  });

  page.drawText("GATES WILL CLOSE 25 MINUTES TO DEPARTURE TIME", {
    x: BORDER_X + 18,
    y: BORDER_Y + 16,
    size: 14,
    font: bold,
    color: rgb(1, 1, 1),
  });

  const boardingTime = booking?.boardingTime
    ? fmtTime(booking.boardingTime)
    : booking?.journeyDate
      ? fmtTime(booking.journeyDate)
      : "-";

  page.drawText(`BOARDING TIME: ${boardingTime}`, {
    x: BORDER_X + BORDER_W - 280,
    y: BORDER_Y + 16,
    size: 14,
    font: bold,
    color: rgb(1, 1, 1),
  });

  // Small center label above orange bar (optional, like the sample)
  page.drawText("", {
    x: width / 2 - 55,
    y: height - 36,
    size: 12,
    font: bold,
    color: dark,
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
  getTransactionInvoice,
};

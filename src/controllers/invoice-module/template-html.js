const path = require("path");

const getHotelInvoiceHTML = (booking, logoDataUrl) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Hotel Booking Invoice</title>
<style>
/* Hide content on non-mobile screens */
      @media (min-width: 768px) {
        body::before {
          content: "This invoice is optimized for mobile devices only.";
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 16px;
          color: #374151;
          background: #f5f6f8;
        }

        .invoice-container {
          display: none;
        }
      }

      /* Mobile styles */
      @media (max-width: 767px) {
        body {
          font-family: Arial, Helvetica, sans-serif;
          background: #f5f6f8;
          margin: 0;
          padding: 16px;
          color: #1f2937;
        }

        .invoice-container {
          background: #ffffff;
          border-radius: 10px;
          padding: 20px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
        }

        .header {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo {
          height: 32px;
        }

        .company-name {
          font-size: 16px;
          font-weight: 600;
          color: #14532d;
        }

        .title {
          font-size: 22px;
          font-weight: 700;
          margin: 20px 0 6px;
        }

        .booking-id {
          font-size: 13px;
          color: #374151;
          word-break: break-all;
        }

        hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 20px 0;
        }

        .two-column {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .section-title {
          font-weight: 700;
          margin-bottom: 10px;
          font-size: 14px;
        }

        .label {
          font-size: 12px;
          color: #6b7280;
          margin-top: 6px;
        }

        .value {
          font-size: 14px;
          margin-top: 2px;
        }

        .status {
          color: #15803d;
          font-weight: 600;
        }

        .guest-name {
          font-weight: 700;
          margin-bottom: 4px;
          font-size: 15px;
        }

        .info-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }

        .info-table td {
          padding: 10px 0;
          border-bottom: 1px solid #e5e7eb;
          font-size: 14px;
          vertical-align: top;
        }

        .info-table td:last-child {
          text-align: right;
          font-weight: 500;
          padding-left: 12px;
        }

        .total {
          font-weight: 700;
          font-size: 16px;
        }

        .thank-you {
          text-align: center;
          color: #15803d;
          font-weight: 600;
          margin: 24px 0;
          font-size: 14px;
        }

        .footer {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #6b7280;
          margin-top: 24px;
        }
      }
</style>
</head>

<body>
  <div class="invoice-container">
    <div class="header">
      <img src="${logoDataUrl}" class="logo" alt="logo"/>
      <div class="company-name">WeMove All.</div>
    </div>

    <div class="title">HOTEL BOOKING INVOICE</div>
    <div class="booking-id">${booking.bookingId}</div>

    <hr />

    <div class="two-column">
      <div>
        <div class="section-title">Booking Details</div>
        <div class="label">Booking By</div>
        <div class="value">${booking.bookingBy}</div>

        <div class="label">Status</div>
        <div class="value status">${booking.status}</div>
      </div>

      <div>
        <div class="section-title">Check-In Details</div>
        <div class="label">Check-In:</div>
        <div class="value">${new Date(
          booking.checkInDate
        ).toLocaleString()}</div>

        <div class="label">Check-Out:</div>
        <div class="value">${new Date(
          booking.checkOutDate
        ).toLocaleString()}</div>
      </div>
    </div>

    <hr />

    <div class="section-title">Guest</div>
    <div class="guest-name">${booking.user[0].name}</div>
    <div class="value">Email: ${booking.user[0].email || "N/A"}</div>
    <div class="value">Phone: ${booking.user[0].phoneNumber || "N/A"}</div>

    <table class="info-table">
      <tr><td>Booking ID</td><td>${booking._id}</td></tr>
      <tr><td>Hotel</td><td>${booking.hotelId?.hotelName}</td></tr>
      <tr><td>No of Rooms</td><td>${booking.noOfRoom}</td></tr>
      <tr>
        <td>Guests</td>
        <td>${booking.noOfAdults} Adults, ${booking.noOfKids} Kids</td>
      </tr>
      <tr>
        <td class="total">Total Amount</td>
        <td class="total">${booking.totalAmount} ${
          process.env.MOMO_CURRENCY
        }</td>
      </tr>
    </table>

    <div class="thank-you">Thank You For booking with us!</div>

    <div class="footer">
      <div>${new Date().toDateString()}</div>
      <div>Page 1 of 1</div>
    </div>
  </div>
</body>
</html>
`;
};

const getTransactionReceiptHTML = (txn, logoDataUrl) => {
  const receiptId = txn.transactionId || String(txn._id);
  const status = String(txn.status || "PENDING").toUpperCase();

  const createdAt = txn.createdAt ? new Date(txn.createdAt) : new Date();
  const dateStr = createdAt.toLocaleDateString();
  const timeStr = createdAt.toLocaleTimeString();

  const metaFrom = txn?.meta?.from || {};
  const metaTo = txn?.meta?.to || {};

  const entries = Array.isArray(txn.entries) ? txn.entries : [];

  // Helper: pick first entry by type/entityType
  const firstBy = (pred) => entries.find(pred);

  // Determine payer (From): prefer meta.from, else any DEBIT entry
  const debitEntry = firstBy((e) => e.type === "DEBIT");
  const fromName =
    metaFrom?.name ||
    debitEntry?.name ||
    (debitEntry?.entityType ? `${debitEntry.entityType}` : "N/A");
  const fromId = metaFrom?.id || debitEntry?.entityId || "N/A";

  // Determine receiver (To): prefer meta.to, else first CREDIT that isn't ADMIN(SYSTEM) if possible
  const creditNonSystem =
    firstBy(
      (e) =>
        e.type === "CREDIT" &&
        !(e.entityType === "ADMIN" && String(e.entityId) === "SYSTEM")
    ) || firstBy((e) => e.type === "CREDIT");

  let toName =
    metaTo?.name ||
    creditNonSystem?.name ||
    (creditNonSystem?.entityType ? `${creditNonSystem.entityType}` : "N/A");
  let toId = metaTo?.id || creditNonSystem?.entityId || "N/A";

  // Preserve your older "override" behavior based on transactionType text
  const txnTypeLower = String(txn.transactionType || "").toLowerCase();
  if (txnTypeLower.includes("hotel")) {
    const hotelCredit =
      firstBy((e) => e.type === "CREDIT" && e.entityType === "HOTEL") || null;
    if (hotelCredit) {
      toName = hotelCredit.name || toName;
      toId = hotelCredit.entityId || toId;
    }
  } else if (txnTypeLower.includes("bus")) {
    const busCredit =
      firstBy((e) => e.type === "CREDIT" && e.entityType === "BUS_OPERATOR") ||
      null;
    if (busCredit) {
      toName = busCredit.name || toName;
      toId = busCredit.entityId || toId;
    }
  } else if (txnTypeLower.includes("ride")) {
    const driverCredit =
      firstBy((e) => e.type === "CREDIT" && e.entityType === "DRIVER") || null;
    if (driverCredit) {
      toName = driverCredit.name || toName;
      toId = driverCredit.entityId || toId;
    }
  }

  const txnTypeText = txn.transactionType || "Transaction";

  // Action text: if there is a USER debit, treat as Paid; if there is a USER credit topup/refund, treat as Received
  const userDebit = firstBy(
    (e) => e.type === "DEBIT" && e.entityType === "USER"
  );
  const actionText = userDebit ? "Paid" : "Received";

  const currency = txn.currency || process.env.MOMO_CURRENCY || "";

  const totalAmount =
    typeof txn.totalAmount === "number" ? txn.totalAmount.toFixed(2) : "0.00";

  const platformFee =
    typeof txn.platformFee === "number" ? txn.platformFee.toFixed(2) : "0.00";

  const bookingId = txn.bookingId || "N/A";

  const hotelName = txn.meta?.hotel?.name || txn.meta?.hotelName || "N/A";
  const hotelAddress =
    txn.meta?.hotel?.address || txn.meta?.hotelAddress || "N/A";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Transaction Receipt</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #f5f6f8;
      margin: 0;
      padding: 16px;
      color: #1f2937;
    }
    .receipt-container {
      background: #ffffff;
      border-radius: 12px;
      padding: 20px;
      box-shadow: none;
      border: 1px solid #e5e7eb;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo { height: 28px; }
    .company-name {
      font-size: 16px;
      font-weight: 600;
      color: #14532d;
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      margin: 18px 0 6px;
    }
    .receipt-id {
      font-size: 13px;
      color: #374151;
      word-break: break-all;
    }
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 16px 0;
    }
    .two-column {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .section-title {
      font-weight: 700;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .label {
      font-size: 12px;
      color: #6b7280;
      margin-top: 6px;
    }
    .value {
      font-size: 14px;
      margin-top: 2px;
    }
    .status {
      color: #15803d;
      font-weight: 700;
      font-size: 14px;
      margin-top: 2px;
    }
    .transaction-type {
      font-weight: 700;
      font-size: 14px;
      margin-bottom: 6px;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    .info-table tr { border-bottom: 1px solid #e5e7eb; }
    .info-table td {
      padding: 10px 0;
      font-size: 14px;
      vertical-align: top;
    }
    .info-table td:last-child {
      text-align: right;
      font-weight: 500;
      padding-left: 12px;
      word-break: break-word;
    }
    .total {
      font-weight: 700;
      font-size: 16px;
    }
    .thank-you {
      text-align: center;
      color: #15803d;
      font-weight: 600;
      margin-top: 20px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <img src="${logoDataUrl}" alt="WeMove All" class="logo" />
      <div class="company-name">WeMove All.</div>
    </div>
    <div class="title">Transaction Receipt</div>
    <div class="receipt-id">${receiptId}</div>
    <hr />
    <div class="two-column">
      <div>
        <div class="section-title">To</div>
        <div class="value">ID: ${toId}</div>
        <div class="value"><strong>${toName}</strong></div>
        <div class="label">Status:</div>
        <div class="status">${status}</div>
      </div>
      <div>
        <div class="section-title">From</div>
        <div class="value">ID: ${fromId}</div>
        <div class="value"><strong>${fromName}</strong></div>
      </div>
    </div>
    <hr />
    <div class="section-title">Transaction Type</div>
    <div class="transaction-type">${txnTypeText} (${actionText})</div>
    <hr />
    <table class="info-table">
      <tr><td>Transaction ID</td><td>${receiptId}</td></tr>
      <tr><td>Date</td><td>${dateStr}</td></tr>
      <tr><td>Time</td><td>${timeStr}</td></tr>
      <tr><td>Booking ID</td><td>${bookingId}</td></tr>
      <tr><td>Commission deducted</td><td>${platformFee} ${currency}</td></tr>
      <tr><td class="total">Total Amount</td><td class="total">${totalAmount} ${currency}</td></tr>
    </table>
  </div>
</body>
</html>
`;
};

module.exports = { getHotelInvoiceHTML, getTransactionReceiptHTML };

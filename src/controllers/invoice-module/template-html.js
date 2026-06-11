const path = require("path");
const { translateLn } = require("../../utils/services/translator.service");
const { resolveGeneratedId } = require("../../utils/services/helper.service");

const getHotelInvoiceHTML = (booking, logoDataUrl, ln) => {
  return `
<!DOCTYPE html>
<html lang="${ln}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${translateLn(ln, "INVOICE_TITLE")}</title>
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

    <div class="title">${translateLn(ln, "INVOICE_TITLE")}</div>
    <div class="booking-id">${booking.bookingId}</div>

    <hr />

    <div class="two-column">
      <div>
        <div class="section-title">${translateLn(ln, "BOOKING_DETAILS")}</div>

        <div class="label">${translateLn(ln, "BOOKING_BY")}</div>
        <div class="value">${booking.bookingBy}</div>

        <div class="label">${translateLn(ln, "STATUS")}</div>
        <div class="value status">${booking.status}</div>
      </div>

      <div>
        <div class="section-title">${translateLn(ln, "CHECKIN_DETAILS")}</div>

        <div class="label">${translateLn(ln, "CHECKIN")}:</div>
        <div class="value">${new Date(
          booking.checkInDate
        ).toLocaleString()}</div>

        <div class="label">${translateLn(ln, "CHECKOUT")}:</div>
        <div class="value">${new Date(
          booking.checkOutDate
        ).toLocaleString()}</div>
      </div>
    </div>

    <hr />

    <div class="section-title">${translateLn(ln, "GUEST")}</div>
    <div class="guest-name">${booking.user[0].name}</div>

    <div class="value">${translateLn(ln, "EMAIL")}: ${
      booking.user[0].email || "N/A"
    }</div>

    <div class="value">${translateLn(ln, "PHONE")}: ${
      booking.user[0].phoneNumber || "N/A"
    }</div>

    <table class="info-table">
      <tr>
        <td>${translateLn(ln, "BOOKING_ID")}</td>
        <td>${booking.bookingId}</td>
      </tr>

      <tr>
        <td>${translateLn(ln, "HOTEL")}</td>
        <td>${booking.hotelId?.hotelName}</td>
      </tr>

      <tr>
        <td>${translateLn(ln, "NO_OF_ROOMS")}</td>
        <td>${booking.noOfRoom}</td>
      </tr>

      <tr>
        <td>${translateLn(ln, "GUESTS")}</td>
        <td>${booking.noOfAdults} ${translateLn(ln, "ADULTS")}, ${booking.noOfKids} ${translateLn(ln, "KIDS")}</td>
      </tr>

      <tr>
        <td class="total">${translateLn(ln, "TOTAL_AMOUNT")}</td>
        <td class="total">${booking.totalAmount} ${process.env.MOMO_CURRENCY}</td>
      </tr>
    </table>

    <div class="thank-you">${translateLn(ln, "THANK_YOU_BOOKING")}</div>

    <div class="footer">
      <div>${new Date().toDateString()}</div>
      <div>${translateLn(ln, "PAGE")} 1 ${translateLn(ln, "OF")} 1</div>
    </div>
  </div>
</body>
</html>
`;
};

const getTransactionReceiptHTML = async (txn, logoDataUrl, ln) => {
  const receiptId = txn.transactionId || String(txn._id);
  const statusMap = {
    en: {
      PENDING: "Pending",
      SUCCESS: "Success",
      FAILED: "Failed",
    },

    fr: {
      PENDING: "En attente",
      SUCCESS: "Succès",
      FAILED: "Échoué",
    },
  };

  const statusColorMap = {
    SUCCESS: "#15803d",
    FAILED: "#dc2626",
    PENDING: "#ca8a04",
  };

  const status = String(txn.status || "PENDING").toUpperCase();
  const statusText = statusMap[ln]?.[status] || status;
  const statusColor = statusColorMap[status] || "#374151";

  const createdAt = txn.createdAt ? new Date(txn.createdAt) : new Date();
  const dateStr = createdAt.toLocaleDateString();
  const timeStr = createdAt.toLocaleTimeString();

  const metaFrom = txn?.meta?.from || {};
  const metaTo = txn?.meta?.to || {};

  const entries = Array.isArray(txn.entries) ? txn.entries : [];

  const firstBy = (pred) => entries.find(pred);

  // helper to check ObjectId
  const isObjectId = (id) => {
    if (!id) return false;

    const str = String(id); // 🔥 force convert
    return /^[a-f\d]{24}$/i.test(str);
  };

  // Determine payer (From)
  const debitEntry = firstBy((e) => e.type === "DEBIT");

  const fromName =
    metaFrom?.name ||
    debitEntry?.name ||
    (debitEntry?.entityType ? `${debitEntry.entityType}` : "N/A");

  const rawFromId = metaFrom?.id || debitEntry?.entityId || "N/A";
  const fromEntityType = metaFrom?.entityType || debitEntry?.entityType;

  let fromId = rawFromId;

  if (isObjectId(rawFromId)) {
    fromId = await resolveGeneratedId(fromEntityType, rawFromId);
  }

  // Determine receiver (To)
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

  let rawToId = metaTo?.id || creditNonSystem?.entityId || "N/A";
  let toEntityType = metaTo?.entityType || creditNonSystem?.entityType;

  // override logic (same as your code)
  const txnTypeLower = String(txn.transactionType || "").toLowerCase();

  if (txnTypeLower.includes("hotel")) {
    const hotelCredit =
      firstBy((e) => e.type === "CREDIT" && e.entityType === "HOTEL") || null;
    if (hotelCredit) {
      toName = hotelCredit.name || toName;
      rawToId = hotelCredit.entityId || rawToId;
      toEntityType = hotelCredit.entityType;
    }
  } else if (txnTypeLower.includes("bus")) {
    const busCredit =
      firstBy((e) => e.type === "CREDIT" && e.entityType === "BUS_OPERATOR") ||
      null;
    if (busCredit) {
      toName = busCredit.name || toName;
      rawToId = busCredit.entityId || rawToId;
      toEntityType = busCredit.entityType;
    }
  } else if (txnTypeLower.includes("ride")) {
    const driverCredit =
      firstBy((e) => e.type === "CREDIT" && e.entityType === "DRIVER") || null;
    if (driverCredit) {
      toName = driverCredit.name || toName;
      rawToId = driverCredit.entityId || rawToId;
      toEntityType = driverCredit.entityType;
    }
  }

  let toId = rawToId;

  if (isObjectId(rawToId)) {
    toId = await resolveGeneratedId(toEntityType, rawToId);
  }

  const transactionTypeMap = {
    en: {
      "Ride Booking": "Ride Booking",
      "Bus Booking": "Bus Booking",
      "Hotel Booking": "Hotel Booking",
      "Wallet Top-up": "Wallet Top-up",
      "User to User Payment": "User to User Payment",
    },

    fr: {
      "Ride Booking": "Réservation de trajet",
      "Bus Booking": "Réservation de bus",
      "Hotel Booking": "Réservation d'hôtel",
      "Wallet Top-up": "Recharge portefeuille",
      "User to User Payment": "Paiement utilisateur à utilisateur",
    },
  };

  const txnTypeText =
    transactionTypeMap[ln]?.[txn.transactionType] ||
    txn.transactionType ||
    "Transaction";

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
  <title>Transacriton Receipt</title>
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
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <img src="${logoDataUrl}" alt="WeMove All" class="logo" />
      <div class="company-name">WeMove All.</div>
    </div>
    <div class="title">${translateLn(ln, "TRANSACTION_RECEIPT")}</div>
    <div class="receipt-id">${receiptId}</div>
    <hr />
    <div class="two-column">
      <div>
        <div class="section-title">${translateLn(ln, "TO")}</div>
        <div class="value">ID: ${toId}</div>
        <div class="value">${translateLn(ln, "NAME")}: <strong>${toName}</strong></div>
        <div class="label">${translateLn(ln, "STATUS")}: </div>
        <div class="status" style="color:${statusColor}">${statusText}</div>
      </div>
      <div>
        <div class="section-title">${translateLn(ln, "FROM")}</div>
        <div class="value">ID: ${fromId}</div>
        <div class="value">${translateLn(ln, "NAME")}: <strong>${fromName}</strong></div>
      </div>
    </div>
    <hr />
    <div class="section-title">${translateLn(ln, "TRANSACTION_TYPE")}</div>
    <div class="transaction-type">${txnTypeText}</div>
    <hr />
    <table class="info-table">
      <tr><td>${translateLn(ln, "TRANSACTION_ID")}</td><td>${receiptId}</td></tr>
      <tr><td>Date</td><td>${dateStr}</td></tr>
      <tr><td>${translateLn(ln, "TIME")}</td><td>${timeStr}</td></tr>
      <tr><td>${translateLn(ln, "BOOKING_ID")}</td><td>${bookingId}</td></tr>
      <tr><td>${translateLn(ln, "COMMISSION_DEDUCTED")}</td><td>${platformFee} ${currency}</td></tr>
      <tr><td class="total">${translateLn(ln, "TOTAL_AMOUNT")}</td><td class="total">${totalAmount} ${currency}</td></tr>
    </table>
  </div>
</body>
</html>
`;
};

module.exports = { getHotelInvoiceHTML, getTransactionReceiptHTML };

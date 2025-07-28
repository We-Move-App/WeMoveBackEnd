const mongoose = require("mongoose");

const driverBankDetailSchema = new mongoose.Schema({
  driverId: { type: String, index: true },
  accountNumber: { type: String },
  holderName: { type: String },
});

module.exports = mongoose.model("DriverBankDetail", driverBankDetailSchema);

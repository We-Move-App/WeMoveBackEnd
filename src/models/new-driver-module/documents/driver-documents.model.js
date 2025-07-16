const mongoose = require("mongoose");
const {
  DriverDocEnum,
  DriverDocStatusEnum,
} = require("../../../utils/constants/ENUM");

const documents = new mongoose.Schema({
  documentType: { type: String, enum: DriverDocEnum },
  fileUrl: { type: String },
  status: {
    type: String,
    enum: DriverDocStatusEnum,
    default: DriverDocStatusEnum.PENDING,
  },
  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
  approvedBy: { type: String, default: null },
  remarks: { type: String, default: null },
});

const driverDocSchema = new mongoose.Schema({
  driverId: { type: String },
  documents: [documents],
});

module.exports = mongoose.model("DriverDocDetails", driverDocSchema);
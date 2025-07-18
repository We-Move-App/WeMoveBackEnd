const mongoose = require("mongoose");
const {
  DriverBasicStatus,
  GenderEnum,
} = require("../../../utils/constants/ENUM");

const driverBasicDetailSchema = new mongoose.Schema({
  driverId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  role: { type: String, default: "Driver" },
  fullName: { type: String },
  phoneNo: { type: String, index: true },
  email: { type: String, index: true },
  gender: { type: String, enum: GenderEnum },
  dob: { type: Date },
  age: { type: Number },
  experience: { type: Number },
  address: { type: String },
  termsAccepted: { type: Boolean },
  ratings: { type: Number, min: 1, max: 5 },
  status: {
    type: String,
    enum: DriverBasicStatus,
    default: DriverBasicStatus.PENDING,
  },
  isActive: { type: Boolean, default: true },
});

module.exports = mongoose.model("DriverBasicDetails", driverBasicDetailSchema);

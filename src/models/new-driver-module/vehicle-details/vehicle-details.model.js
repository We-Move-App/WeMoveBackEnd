const mongoose = require("mongoose");
const { VehicleTypeEnum } = require("../../../utils/constants/ENUM");

const vehicleDetailsSchema = new mongoose.Schema({
  driverId: { type: String, index: true },
  vehicleType: { type: String, enum: VehicleTypeEnum },
  seats: { type: Number, index: true },
  model: { type: String },
  registrationNo: { type: String },
});

module.exports = mongoose.model("VehicleDetail", vehicleDetailsSchema);

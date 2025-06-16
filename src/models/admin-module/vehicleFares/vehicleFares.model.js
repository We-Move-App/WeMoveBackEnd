const mongoose = require("mongoose");

const VehicleFareSchema = new mongoose.Schema({
  baseFare: { type: Number, required: true },
  perKmRate: { type: Number, required: true },
  minimumFare: { type: Number, required: true },
});

const VehicleFare = new mongoose.Schema({
  category: { type: String, required: true, enum: ["bike", "taxi"] },

  // Nested Fare Structures
  taxiFare: {
    sedan: { type: VehicleFareSchema, default: {} },
    mini: { type: VehicleFareSchema, default: {} },
    economy: { type: VehicleFareSchema, default: {} },
  },

  bikeFare: {
    scooter: { type: VehicleFareSchema, default: {} },
    motorbike: { type: VehicleFareSchema, default: {} },
  },
});

const VehicleFareModel = mongoose.model("VehicleFare", VehicleFare);
module.exports = { VehicleFareModel };

const mongoose = require("mongoose");
const { Schema } = mongoose;

function validateSubType(subType, vehicleType) {
  const validSubTypes = {
    taxi: ["sedan", "mini", "economy"],
    bike: ["scooter", "motorbike"],
  };

  return validSubTypes[vehicleType]?.includes(subType) || false;
}

const vehicleSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },
    vehicle: {
      type: String,
      enum: ["taxi", "bike"],
      required: true,
    },
    vehicleType: {
      type: String,
      required: true,
      validate: {
        validator: function (value) {
          return validateSubType(value, this.vehicle);
        },
        message: "Invalid sub-type for the selected vehicle type",
      },
      default: function () {
        if (this.vehicle === "taxi") return "economy";
        if (this.vehicle === "bike") return "motorbike";
        return null;
      },
    },
    model: {
      type: String,
      required: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
    },
    color: {
      type: String,
    },
    capacity: {
      type: Number,
      default: function () {
        return this.vehicle === "taxi" ? 4 : 2;
      },
    },
    fuelType: {
      type: String,
      enum: ["petrol", "diesel", "electric", "hybrid"],
      default: "petrol",
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const DriverVehicleModel = mongoose.model("DriverVehicle", vehicleSchema);

module.exports = DriverVehicleModel;

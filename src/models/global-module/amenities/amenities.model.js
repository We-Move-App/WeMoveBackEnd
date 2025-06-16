const mongoose = require("mongoose");

const amenitiesSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: " ",
    },
    icon: {
        type: String,
        },  
    type: {
      type: String,
      enum: ["hotel", "room", "bus"],
      required: true,
    },
  },
  { timestamps: true }
);

const AmenitiesModel = mongoose.model("Amenities", amenitiesSchema);

module.exports = AmenitiesModel;

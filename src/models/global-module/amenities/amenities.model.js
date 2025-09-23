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
      required: false,
    },
    status: {
      type: String,
      enum: ["active", "inActive"],
      default: "active",  // default status
    },

    type: {
      type: String,
      enum: ["hotel", "room", "bus"],
      required: true,
    },
  },
  { timestamps: true },
  {

    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  }
);

const AmenitiesModel = mongoose.model("Amenities", amenitiesSchema);

module.exports = AmenitiesModel;

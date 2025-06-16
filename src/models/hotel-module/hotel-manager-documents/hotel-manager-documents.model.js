const mongoose = require("mongoose");

const HotelManagerDocumentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel-Manager",
      required: true,
    },
    documentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
        required: true,
      },
    ],
  },
  {
    timestamps: true, 
  }
);

const HotelManagerDocumentModel = mongoose.model(
  "Hotel-Manager-Document",
  HotelManagerDocumentSchema
);

module.exports = { HotelManagerDocumentModel };

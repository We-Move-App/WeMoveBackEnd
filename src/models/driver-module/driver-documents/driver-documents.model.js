const mongoose = require("mongoose");

const DriverDocumentsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
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

const DriverDocumentsModel = mongoose.model(
  "DriverDocument",
  DriverDocumentsSchema
);
module.exports = { DriverDocumentsModel };

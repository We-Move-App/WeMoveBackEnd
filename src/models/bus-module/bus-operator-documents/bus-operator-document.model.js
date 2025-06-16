const mongoose = require("mongoose");

const BusOperatorDocumentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusOperator",
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

const BusOperatorDocumentModel = mongoose.model(
  "BusOperatorDocument",
  BusOperatorDocumentSchema
);
module.exports = { BusOperatorDocumentModel };

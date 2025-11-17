const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const TransactionCounterModel = mongoose.model(
  "TransactionCounter",
  counterSchema
);
module.exports = TransactionCounterModel;

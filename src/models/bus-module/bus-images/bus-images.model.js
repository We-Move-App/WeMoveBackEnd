const mongoose = require("mongoose");
const { ImageSchema } = require("../../../utils/validation/forSchema");
const { Schema } = mongoose;

const BusImageSchema = new Schema(
  {
    busId: {
      type: Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    images: {
      type: [ImageSchema],
      required: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "BusOperator",
      required: true,
    },
  },
  { timestamps: true }
);

const BusImagesModel = mongoose.model("BusImage", BusImageSchema);
module.exports = BusImagesModel;

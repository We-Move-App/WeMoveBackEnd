const mongoose = require("mongoose");
const { ImageSchema } = require("../../../utils/validation/forSchema");
const { Schema } = mongoose;

const hotelImageSchema = new Schema(
  {
    hotelId: {
      type: Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },
    images: {
      type: [ImageSchema],
      required: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "Hotel-Manager",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HotelImage", hotelImageSchema);

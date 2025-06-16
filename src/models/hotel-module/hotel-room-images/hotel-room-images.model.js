const mongoose = require("mongoose");
const { ImageSchema } = require("../../../utils/validation/forSchema"); 
const { Schema } = mongoose;


const hotelRoomImageSchema = new Schema(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "Room", 
      required: true,
    },
    roomType: {
      type: String,
      enum: ["standard", "luxury"], 
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

// Creating and exporting the model
const HotelRoomImagesModel = mongoose.model(
  "hotel-Room-Image", 
  hotelRoomImageSchema 
);

module.exports = HotelRoomImagesModel; 

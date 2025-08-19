const mongoose = require("mongoose");

const hotelPolicySchema = new mongoose.Schema(
  {
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: false,
    },
    checkInTime: {
      type: String,
      required: true,
      trim: true, 
      validate: {
        validator: function (value) {
          return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value); 
        },
        message: "Invalid check-in time format. Use HH:mm (24-hour format).",
      },
    },
    checkOutTime: {
      type: String,
      required: true,
      trim: true, 
      validate: {
        validator: function (value) {
          return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value); 
        },
        message: "Invalid check-out time format. Use HH:mm (24-hour format).",
      },
    },
    amenities: [
      {
        name: { type: String, required: true },
        status: { type: Boolean, default: false },
      },
    ],
    uploadDocuments: [
  {
    name: { type: String, required: false },
    fileUrl: { type: String, required: true },
    public_id: { type: String },
    fileName: { type: String },
    fileType: { type: String }
  }
]

  },
  { timestamps: true }
);

hotelPolicySchema.pre("validate", function (next) {
  const checkInTime = this.checkInTime.trim(); 
  const checkOutTime = this.checkOutTime.trim(); 

  const checkInParts = checkInTime.split(":").map(Number);
  const checkOutParts = checkOutTime.split(":").map(Number);

  const checkInMinutes = checkInParts[0] * 60 + checkInParts[1]; 
  const checkOutMinutes = checkOutParts[0] * 60 + checkOutParts[1];

  if (checkOutMinutes <= checkInMinutes) {
    return next(new Error("Check-out time must be later than check-in time."));
  }

  next();
});

const HotelPolicyModel = mongoose.model("Hotel-Policy", hotelPolicySchema);
module.exports = HotelPolicyModel;

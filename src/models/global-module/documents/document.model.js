const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    ownerId: {
      type: String,
    },
    documentName: {
      type: String,
      trim: true,
      required: [true, "Document name is required"],
    },
    file: {
      type: Object,
      required: [true, "Document file is required"],
      trim: true,
    },
    documentType: {
      type: String,
      enum: [
        "driver_license_front",
        "driver_license_back",
        "hotel_license",
        "bus_license",
        "bank_detail",
        "vehicle_registration_certificate",
        "vehicle_insurance",
        "identity_card",
        "passport",
        "national_identity_card_front",
        "national_identity_card_back",
        "bus_license_front",
        "bus_license_back",
        "driving_license",
        "vehicle_photo",
      ],
      required: [true, "Document type is required"],
    },
    fileType: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const DocumentsModel = mongoose.model("Document", documentSchema);

module.exports = { DocumentsModel };

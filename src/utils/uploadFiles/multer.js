const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Define the upload directory
const uploadDir = path.join(__dirname, "uploads");

// Ensure the uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure the directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = file.originalname.split(".")[0];
    const ext = file.originalname.split(".").pop();
    cb(null, `${filename}-${uniqueSuffix}.${ext}`);
  },
});

const uploads = multer({ storage: storage });
const uploadAvatar = uploads.fields([{ name: "avatar", maxCount: 1 }]);

const uploadImages = uploads.array("images", 10);

const uploadFile = uploads.single("file");

const uploadHotelImages = uploads.fields([
  { name: "hotelImages", maxCount: 10 },
]);

const uploadRoomImages = uploads.fields([{ name: "roomImages", maxCount: 20 }]);

const uploadBusImages = uploads.fields([
  { name: "busImages", maxCount: 10 },
  { name: "bus_license_front", maxCount: 1 },
  { name: "bus_license_back", maxCount: 1 },
]);

const uploadAmenityImages = uploads.array("amenityImages", 20);

const uploadDocuments = uploads.fields([
  { name: "driver_license", maxCount: 1 },
  { name: "hotel_license", maxCount: 1 },
  { name: "bus_license", maxCount: 1 },
  { name: "bank_detail", maxCount: 1 },
  { name: "vehicle_registration_certificate", maxCount: 1 },
  { name: "vehicle_insurance", maxCount: 1 },
  { name: "identity_card", maxCount: 1 },

  {
    name: "national_identity_card_front",
    maxCount: 1,
  },
  {
    name: "national_identity_card_back",
    maxCount: 1,
  },
  {
    name: "vehicle_photo",
    maxCount: 1,
  },
  {
    name: "driver_license_front",
    maxCount: 1,
  },
  {
    name: "driver_license_back",
    maxCount: 1,
  },
  {
    name: "avatar",
    maxCount: 1,
  },
]);

const uploadDriverDetailsDocs = uploads.fields([
  {
    name: "national_identity_card_front",
    maxCount: 1,
  },
  {
    name: "driver_license_front",
    maxCount: 1,
  },
]);

const deleteFileFromDisk = async (filePath) => {
  try {
    await fs.access(filePath);
    await fs.unlink(filePath);

    console.log(`Deleted file: ${filePath}`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(
        `Failed to delete file: ${filePath}, Error: ${error.message}`
      );
    }
  }
};

const uploadHotelManagerFiles = uploads.fields([
  { name: "avatar", maxCount: 1 },
  { name: "hotelImages", maxCount: 10 },
  { name: "roomImages", maxCount: 20 },

  { name: "driver_license", maxCount: 1 },
  { name: "hotel_license", maxCount: 1 },
  { name: "bus_license", maxCount: 1 },
  { name: "bank_detail", maxCount: 1 },
  { name: "vehicle_registration_certificate", maxCount: 1 },
  { name: "vehicle_insurance", maxCount: 1 },
  { name: "identity_card", maxCount: 1 },

  { name: "national_identity_card_front", maxCount: 1 },
  { name: "national_identity_card_back", maxCount: 1 },
  { name: "vehicle_photo", maxCount: 1 },
  { name: "driver_license_front", maxCount: 1 },
  { name: "driver_license_back", maxCount: 1 },
]);

module.exports = {
  uploadAvatar,
  uploadAmenityImages,
  uploadImages,
  uploadFile,
  uploadDocuments,
  deleteFileFromDisk,
  uploadBusImages,
  uploadHotelImages,
  uploadRoomImages,
  uploadDriverDetailsDocs,
  uploadHotelManagerFiles,
};

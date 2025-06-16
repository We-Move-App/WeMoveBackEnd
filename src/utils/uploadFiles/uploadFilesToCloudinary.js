const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const {
  cloud_name,
  cloud_api_key,
  cloud_api_secret,
} = require("../../config/config");

cloudinary.config({
  cloud_name: cloud_name,
  api_key: cloud_api_key,
  api_secret: cloud_api_secret,
});

const uploadImageOnCloudinary = async (
  localFilePath,
  folderName = "wemove"
) => {
  try {
    if (!localFilePath) return null;

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: folderName,
    });
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    return response;
  } catch (error) {
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    return null;
  }
};

const deleteImageFromCloudinary = async (publicId) => {
  try {
    if (!publicId) {
      throw new Error("Public ID is required to delete an image.");
    }

    const response = await cloudinary.uploader.destroy(publicId);
    if (response.result !== "ok") {
      throw new Error(`Failed to delete image with public ID: ${publicId}`);
    }

    console.log(`Image with public ID '${publicId}' deleted successfully.`);
    return response;
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error.message);
    throw error;
  }
};

module.exports = { uploadImageOnCloudinary, deleteImageFromCloudinary };

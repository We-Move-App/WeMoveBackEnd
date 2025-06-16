const fs = require("fs");
const path = require("path");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const {
  aws_region,
  aws_access_key_id,
  aws_secret_access_key,
  aws_bucket_name,
} = require("../../config/config");

const s3 = new S3Client({
  region: aws_region,
  credentials: {
    accessKeyId: aws_access_key_id,
    secretAccessKey: aws_secret_access_key,
  },
});

const awsBucketName = aws_bucket_name;
const awsRegion = aws_region;

const uploadImageOnAws = async (localFilePath, folderName = "wemove") => {
  try {
    if (!localFilePath) return null;

    const fileStream = fs.createReadStream(localFilePath);
    const fileName = `${folderName}/${Date.now()}-${path.basename(localFilePath)}`;

    const uploadParams = {
      Bucket: awsBucketName,
      Key: fileName,
      Body: fileStream,
      ContentType: "auto",
    };

    await s3.send(new PutObjectCommand(uploadParams));

    // Remove local file after upload
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return {
      secure_url: `https://${awsBucketName}.s3.${awsRegion}.amazonaws.com/${fileName}`,
      public_id: fileName,
    };
  } catch (error) {
    console.error("Upload Error:", error);

    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return null;
  }
};

const deleteImageFromAws = async (fileKey) => {
  try {
    if (!fileKey) throw new Error("File key is required to delete an image.");

    
    const deleteParams = {
      Bucket: awsBucketName,
      Key: fileKey,
    };

    await s3.send(new DeleteObjectCommand(deleteParams));

    console.log(`Image '${fileKey}' deleted successfully.`);
    return { success: true, message: `Image '${fileKey}' deleted.` };
  } catch (error) {
    console.error("Error deleting image from S3:", error.message);
    return null;
  }
};

module.exports = { uploadImageOnAws, deleteImageFromAws };

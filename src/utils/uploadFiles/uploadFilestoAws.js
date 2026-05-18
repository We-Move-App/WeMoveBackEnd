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

  do_access_key,
  do_bucket_name,
  do_endpoint,
  do_secret_key,
} = require("../../config/config");

const s3 = new S3Client({
  region: "us-east-1", // any value works for DO Spaces
  endpoint: do_endpoint,
  credentials: {
    accessKeyId: do_access_key,
    secretAccessKey: do_secret_key,
  },
  forcePathStyle: false,
});

const bucketName = do_bucket_name;

const uploadImageOnAws = async (localFilePath, folderName = "wemove") => {
  try {
    if (!localFilePath) return null;

    const fileStream = fs.createReadStream(localFilePath);

    const fileName = `${folderName}/${Date.now()}-${path.basename(
      localFilePath
    )}`;

    const uploadParams = {
      Bucket: bucketName,
      Key: fileName,
      Body: fileStream,
      ACL: "public-read",
      ContentType: mime.lookup(localFilePath) || "application/octet-stream",
    };

    await s3.send(new PutObjectCommand(uploadParams));

    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return {
      secure_url: `${do_endpoint}/${fileName}`,
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
    if (!fileKey) {
      throw new Error("File key is required");
    }

    const deleteParams = {
      Bucket: bucketName,
      Key: fileKey,
    };

    await s3.send(new DeleteObjectCommand(deleteParams));

    console.log(`Deleted: ${fileKey}`);

    return {
      success: true,
      message: `Deleted ${fileKey}`,
    };
  } catch (error) {
    console.error("Delete Error:", error);

    return null;
  }
};

module.exports = {
  uploadImageOnAws,
  deleteImageFromAws,
};

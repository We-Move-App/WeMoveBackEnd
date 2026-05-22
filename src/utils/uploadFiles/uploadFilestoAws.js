const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");
const mime = require("mime-types");

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

const deleteLocalFile = async (filePath) => {
  try {
    await fsPromises.access(filePath);
    await fsPromises.unlink(filePath);

    console.log(`Deleted local file: ${filePath}`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Delete local file error:", error.message);
    }
  }
};

const uploadImageOnAws = async (
  localFilePath,
  originalFileName,
  folderName = "wemove"
) => {
  try {
    if (!localFilePath) return null;

    if (!fs.existsSync(localFilePath)) {
      throw new Error("File does not exist");
    }

    const fileStream = fs.createReadStream(localFilePath);

    // GET EXTENSION
    const ext = path.extname(originalFileName);

    // CREATE FILE NAME WITH EXTENSION
    const fileName = `${folderName}/${Date.now()}${ext}`;

    const uploadParams = {
      Bucket: bucketName,
      Key: fileName,
      Body: fileStream,
      ACL: "public-read",
      ContentType: mime.lookup(originalFileName) || "application/octet-stream",
    };

    await s3.send(new PutObjectCommand(uploadParams));

    await deleteLocalFile(localFilePath);

    return {
      secure_url: `https://${bucketName}.blr1.digitaloceanspaces.com/${fileName}`,
      public_id: fileName,
    };
  } catch (error) {
    console.error("Upload Error:", error);

    await deleteLocalFile(localFilePath);

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

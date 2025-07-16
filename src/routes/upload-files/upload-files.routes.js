const express=require('express');
const { uploadImageHandler } = require('../../controllers/upload-files/upload-files.controller');
const UploadFileRouter=express.Router();
const multer=require('multer')

const storage = multer.diskStorage({});
const upload = multer({ storage });

UploadFileRouter.post("/upload", upload.array("image", 1), uploadImageHandler);

module.exports=UploadFileRouter
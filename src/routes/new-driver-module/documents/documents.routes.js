const express=require('express');
const { uploadAvatar,updateDocumentByType,getDocumentsByTypes } = require('../../../controllers/new-driver-module/documets/documents.controller');
const driverDocRouter=express.Router();


driverDocRouter.post('/upload-avatar',uploadAvatar);
driverDocRouter.put('/update-documents',updateDocumentByType);
driverDocRouter.post('/get-documents',getDocumentsByTypes);

module.exports=driverDocRouter
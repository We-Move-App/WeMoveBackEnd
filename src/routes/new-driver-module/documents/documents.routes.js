const express = require("express");
const {
  uploadAvatar,
  updateDocumentByType,
  getDocumentsByTypes,
  deleteDocumentByType,
} = require("../../../controllers/new-driver-module/documets/documents.controller");
const {
  isNDriverAuthenticated,
} = require("../../../middlewares/authNewDriver");
const driverDocRouter = express.Router();

driverDocRouter.post("/upload-avatar", isNDriverAuthenticated, uploadAvatar);
driverDocRouter.put(
  "/update-documents",
  isNDriverAuthenticated,
  updateDocumentByType
);
driverDocRouter.post(
  "/get-documents",
  isNDriverAuthenticated,
  getDocumentsByTypes
);
driverDocRouter.delete(
  "/delete-documents/:documentType",
  isNDriverAuthenticated,
  deleteDocumentByType
);

module.exports = driverDocRouter;

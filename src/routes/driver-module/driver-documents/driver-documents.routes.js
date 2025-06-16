const express = require("express");
const { uploadDocuments } = require("../../../utils/uploadFiles/multer");
const { isDriverAuthenticated } = require("../../../middlewares/authDriver");
const {
  getDocument,
  addDocument,
  editDocuments,
  deleteDocument,
  editSingleDocument,
} = require("../../../controllers/driver-module/driver-documents/driver-documents.controllers");

const driverDocumentRoutes = express.Router();

driverDocumentRoutes.route("/").get(isDriverAuthenticated, getDocument);
driverDocumentRoutes
  .route("/add")
  .post(isDriverAuthenticated, uploadDocuments, addDocument);
driverDocumentRoutes
  .route("/updates")
  .put(isDriverAuthenticated, uploadDocuments, editDocuments);
driverDocumentRoutes
  .route("/edit/:id")
  .put(isDriverAuthenticated, uploadDocuments, editSingleDocument);
driverDocumentRoutes
  .route("/delete")
  .delete(isDriverAuthenticated, deleteDocument);

module.exports = driverDocumentRoutes;

const express = require("express");
const { uploadDocuments } = require("../../../utils/uploadFiles/multer");
const {
  getDocument,
  addDocument,
  editDocuments,
  editSingleDocument,
  deleteDocument,
} = require("../../../controllers/bus-module/bus-operator-documents/bus-operator-documents.controllers");
const {
  isBusOperatorAuthenticated,
} = require("../../../middlewares/authBusOperator");

const busOperatorDocumentRoutes = express.Router();

busOperatorDocumentRoutes
  .route("/")
  .get(isBusOperatorAuthenticated, getDocument);
busOperatorDocumentRoutes
  .route("/add")
  .post(isBusOperatorAuthenticated, uploadDocuments, addDocument);
busOperatorDocumentRoutes
  .route("/updates")
  .put(isBusOperatorAuthenticated, uploadDocuments, editDocuments);
busOperatorDocumentRoutes
  .route("/edit/:id")
  .put(isBusOperatorAuthenticated, uploadDocuments, editSingleDocument);
busOperatorDocumentRoutes
  .route("/delete")
  .delete(isBusOperatorAuthenticated, deleteDocument);

module.exports = busOperatorDocumentRoutes;

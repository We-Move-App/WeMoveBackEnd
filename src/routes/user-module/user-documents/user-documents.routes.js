const express = require("express");
const { uploadDocuments } = require("../../../utils/uploadFiles/multer");
const { isUserAuthenticated } = require("../../../middlewares/authUser");
const {
  getDocument,
  addDocument,
  editDocuments,
  editSingleDocument,
  deleteDocuments,
  deleteDocumentById,
} = require("../../../controllers/user-module/user-documents/user-documents.controllers");

const userDocumentRoutes = express.Router();

userDocumentRoutes.route("/").get(isUserAuthenticated, getDocument);
userDocumentRoutes
  .route("/add")
  .post(isUserAuthenticated, uploadDocuments, addDocument);
userDocumentRoutes
  .route("/updates")
  .put(isUserAuthenticated, uploadDocuments, editDocuments);
userDocumentRoutes
  .route("/edit/:id")
  .put(isUserAuthenticated, uploadDocuments, editSingleDocument);
userDocumentRoutes
  .route("/delete")
  .delete(isUserAuthenticated, deleteDocuments);
userDocumentRoutes
  .route("/delete-single/:id")
  .delete(isUserAuthenticated, deleteDocumentById);

module.exports = userDocumentRoutes;

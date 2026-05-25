const {
  DriverDocumentsModel,
} = require("../../../models/driver-module/driver-documents/driver-documents.model");
const {
  DocumentsModel,
} = require("../../../models/global-module/documents/document.model");
const { documentTypes } = require("../../../utils/constants/constants");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  uploadImageOnAws,
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");
const mongoose = require("mongoose");

const getDocument = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const { name } = req.query;

  const userDocuments = await DriverDocumentsModel.findOne({ userId: _id })
    .populate({
      path: "documentIds",
      select: "documentName file documentType ownerId",
    })
    .exec();

  if (!userDocuments) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "No documents found for this user"
    );
  }

  let filteredDocuments = userDocuments.documentIds;

  // If a query parameter (name) is provided, filter the documents
  if (name) {
    filteredDocuments = filteredDocuments.filter(
      (doc) => doc.documentName.toLowerCase() === name.toLowerCase()
    );
  }

  return res.status(statusCode.CREATED).json(
    new ApiResponse(
      statusCode.CREATED,
      {
        _id: userDocuments._id,
        userId: userDocuments.userId,
        documentIds: filteredDocuments,
        createdAt: userDocuments.createdAt,
        updatedAt: userDocuments.updatedAt,
      },
      "Documents found"
    )
  );
});

const addDocument = catchAsyncError(async (req, res, next) => {
  const { _id: userId } = req.user;
  const docsToUpload = req.files;

  if (!docsToUpload || docsToUpload?.length === 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "Add all required files");
  }

  const keys = Object.keys(req.files);

  const validDocumentTypes = documentTypes;

  // Handle invalid keys
  const invalidKeys = keys.filter((key) => !validDocumentTypes.includes(key));
  if (invalidKeys.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid document types: ${invalidKeys.join(", ")}`
    );
  }

  // Check for existing documents with the same keys
  const userDocument = await DriverDocumentsModel.findOne({ userId }).populate(
    "documentIds"
  );

  const existingDocumentTypes = userDocument
    ? userDocument.documentIds.map((doc) => doc.documentType)
    : [];

  const duplicateKeys = keys.filter((key) =>
    existingDocumentTypes.includes(key)
  );

  if (duplicateKeys.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Documents already exist for the following types: ${duplicateKeys.join(
        ", "
      )}`
    );
  }

  // Upload new documents
  let docsIds = [];
  for (const key of keys) {
    const imgFile = docsToUpload[key][0];
    // const cloudImage = await uploadImageOnCloudinary(imgFile.path);
    const cloudImage = await uploadImageOnAws(
      imgFile.path,
      imgFile.originalname
    );

    const uploadedDoc = await DocumentsModel.create({
      documentName: key,
      documentType: key,
      file: {
        public_id: cloudImage?.public_id,
        url: cloudImage?.secure_url,
      },
      fileType: imgFile.mimetype,
      ownerId: req.user._id,
    });

    docsIds.push(uploadedDoc._id);
  }

  // Add new document IDs to the user's document list
  if (!userDocument) {
    // If no entry exists, create a new one
    await DriverDocumentsModel.create({
      userId,
      documentIds: docsIds,
    });
  } else {
    // Update the existing entry
    userDocument.documentIds.push(...docsIds);
    await userDocument.save();
  }

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        { userId, documentIds: docsIds },
        "Documents added successfully"
      )
    );
});

const editDocuments = catchAsyncError(async (req, res, next) => {
  let { documentIds } = req.body;
  const docsToUpload = req.files;

  if (!documentIds || documentIds.length === 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please select at least one document to update"
    );
  }

  if (typeof documentIds === "string") {
    try {
      documentIds = JSON.parse(documentIds);
    } catch (err) {
      throw new ApiError(statusCode.BAD_REQUEST, "Invalid document IDs format");
    }
  }

  if (!Array.isArray(documentIds)) {
    throw new ApiError(statusCode.BAD_REQUEST, "documentIds must be an array");
  }

  if (!docsToUpload || Object.keys(docsToUpload).length === 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "Add all required files");
  }

  if (Object.keys(docsToUpload).length !== documentIds.length) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Number of files and document IDs should be equal"
    );
  }

  // Validate each documentId
  const validDocumentIds = documentIds.filter((id) =>
    mongoose.Types.ObjectId.isValid(id)
  );
  if (validDocumentIds.length !== documentIds.length) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "One or more provided document IDs are invalid"
    );
  }

  const keys = Object.keys(docsToUpload);
  const validDocumentTypes = documentTypes;

  // Validate document types
  const invalidKeys = keys.filter((key) => !validDocumentTypes.includes(key));
  if (invalidKeys.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid document types: ${invalidKeys.join(", ")}`
    );
  }

  // Update documents

  const updatedDocs = await Promise.all(
    validDocumentIds.map(async (documentId) => {
      const docToEdit = await DocumentsModel.findById(documentId);
      if (!docToEdit) {
        throw new ApiError(
          statusCode.NOT_FOUND,
          `Document with ID ${documentId} not found`
        );
      }

      const documentType = docToEdit.documentType;
      if (!docsToUpload[documentType]) {
        return null; // Skip if no new file provided for this document type
      }

      const newFile = docsToUpload[documentType][0];
      if (newFile?.path) {
        await deleteImageFromAws(docToEdit.file?.public_id);
        const cloudImage = await uploadImageOnAws(
          newFile.path,
          newFile.originalname
        );

        // Update document in database
        docToEdit.file = {
          public_id: cloudImage.public_id,
          url: cloudImage.secure_url,
        };
        await docToEdit.save();
        return docToEdit;
      }
      return null; // If no file uploaded, return null
    })
  );

  // Filter out null values (documents that weren't updated)
  const filteredDocs = updatedDocs.filter((doc) => doc !== null);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { updatedDocuments: filteredDocs },
        "Documents updated successfully"
      )
    );
});

const editSingleDocument = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const { id } = req.params;
  const docToEdit = req.files;

  if (!id) {
    throw new ApiError(statusCode.BAD_REQUEST, "Please provide a doc ID.");
  }
  if (!docToEdit || !docToEdit.length === 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "No file uploaded.");
  }
  const keys = Object.keys(req.files);

  const validDocumentTypes = documentTypes;

  const invalidKeys = keys.filter((key) => !validDocumentTypes.includes(key));
  if (invalidKeys.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid document types: ${invalidKeys.join(", ")}`
    );
  }
  const userDocument = await DriverDocumentsModel.findOne({
    userId: _id,
    documentIds: { $in: id },
  });

  // Retrieve the document entry from the `DocumentsModel`
  const documentToUpdate = await DocumentsModel.findById(id);

  if (!documentToUpdate) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "Document not found in the database."
    );
  }

  const publicId = documentToUpdate?.file.public_id;

  if (publicId) {
    // await deleteImageFromCloudinary(publicId);
    await deleteImageFromAws(publicId);
  }

  const documentKey = keys[0];
  const uploadedFile = await uploadImageOnAws(
    docToEdit[documentKey][0].path,
    docToEdit[documentKey][0].originalname
  );

  if (!uploadedFile) {
    throw new ApiError(
      statusCode.INTERNAL_SERVER_ERROR,
      "Failed to upload new file."
    );
  }
  const result = {
    public_id: uploadedFile?.public_id,
    url: uploadedFile?.secure_url,
  };

  documentToUpdate.documentName = documentKey;
  documentToUpdate.file = result;
  documentToUpdate.documentType = documentKey;
  await documentToUpdate.save();

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        { userId: _id, documentToUpdate },
        `Document updated ${documentKey} successfully`
      )
    );
});

const deleteDocument = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  let user_id;
  const { documentIds, userId } = req.body;

  user_id = mongoose.Types.ObjectId.isValid(userId) ? userId : _id;

  if (!documentIds || documentIds.length === 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Please select at least one document to delete"
    );
  }

  // Ensure all documentIds are valid ObjectIds
  const validDocumentIds = documentIds.filter((id) =>
    mongoose.Types.ObjectId.isValid(id)
  );

  if (validDocumentIds.length === 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "Invalid document IDs provided");
  }

  // Fetch documents to get Cloudinary public IDs
  const documentsToDelete = await DocumentsModel.find({
    _id: { $in: validDocumentIds },
  });

  if (!documentsToDelete.length) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      "No documents found with the provided IDs"
    );
  }

  // Remove document IDs from the user's document list
  const user = await DriverDocumentsModel.findOneAndUpdate(
    { userId: user_id },
    { $pull: { documentIds: { $in: validDocumentIds } } },
    { new: true }
  );

  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  for (const doc of documentsToDelete) {
    const publicId = doc.file.public_id;
    if (publicId) {
      await deleteImageFromAws(publicId);
    }
  }

  // Delete the actual document entries from the database
  const docsDeleted = await DocumentsModel.deleteMany({
    _id: { $in: validDocumentIds },
  });

  return res.status(200).json({
    success: true,
    message: "Documents deleted successfully",
    deletedCount: docsDeleted.deletedCount,
  });
});

module.exports = {
  getDocument,
  addDocument,
  editDocuments,
  editSingleDocument,
  deleteDocument,
};

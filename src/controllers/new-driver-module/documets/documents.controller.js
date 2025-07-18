const statusCode = require("../../../utils/constants/statusCode");
const {
  decodeAccessToken,
} = require("../../../utils/jwtToken/customTokenService");
const ApiError = require("../../../utils/response/ApiError");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const DriverDocDetails = require("../../../models/new-driver-module/documents/driver-documents.model");
const {
  DriverDocEnum,
  DriverDocStatusEnum,
} = require("../../../utils/constants/ENUM");
const ApiResponse = require("../../../utils/response/ApiResponse");

const uploadAvatar = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded?.driverId;
  if (!driverId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const { fileUrl, fileName } = req.body;
  if (!fileUrl || !fileName) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "fileUrl and fileName are required"
    );
  }

  const existingDocEntry = await DriverDocDetails.findOne({ driverId });

  const avatarDoc = {
    documentType: DriverDocEnum.AVATAR,
    fileUrl,
    fileName,
    status: DriverDocStatusEnum.PENDING,
    updatedAt: new Date(),
    createdAt: new Date(),
  };

  if (!existingDocEntry) {
    await DriverDocDetails.create({
      driverId,
      documents: [avatarDoc],
    });
  } else {
    const docsMap = new Map();
    existingDocEntry.documents.forEach((doc) =>
      docsMap.set(doc.documentType, doc)
    );
    docsMap.set(DriverDocEnum.AVATAR, avatarDoc);

    await DriverDocDetails.updateOne(
      { driverId },
      {
        $set: {
          documents: Array.from(docsMap.values()),
          updatedAt: new Date(),
        },
      }
    );
  }

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(statusCode.CREATED, null, "Avatar uploaded successfully")
    );
});

const updateDocumentByType = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded?.driverId;
  if (!driverId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const { documentType, fileUrl, fileName } = req.body;
  if (!documentType || !fileUrl || !fileName) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "documentType, fileUrl, fileName are required"
    );
  }

  const docEntry = await DriverDocDetails.findOne({ driverId });

  let updatedDoc;

  if (!docEntry) {
    updatedDoc = {
      documentType,
      fileUrl,
      fileName,
      status: DriverDocStatusEnum.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await DriverDocDetails.create({
      driverId,
      documents: [updatedDoc],
    });
  } else {
    const index = docEntry.documents.findIndex(
      (doc) => doc.documentType === documentType
    );

    if (
      index !== -1 &&
      docEntry.documents[index].status === DriverDocStatusEnum.APPROVED
    ) {
      return res
        .status(statusCode.OK)
        .json(
          new ApiResponse(
            statusCode.OK,
            docEntry.documents[index],
            "Document is already approved"
          )
        );
    }

    updatedDoc = {
      documentType,
      fileUrl,
      fileName,
      status: DriverDocStatusEnum.PENDING,
      updatedAt: new Date(),
      createdAt: docEntry.documents[index]?.createdAt || new Date(),
    };

    if (index !== -1) {
      docEntry.documents[index] = updatedDoc;
    } else {
      docEntry.documents.push(updatedDoc);
    }

    docEntry.updatedAt = new Date();
    await docEntry.save();
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        updatedDoc,
        "Document updated successfully"
      )
    );
});

const getDocumentsByTypes = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded?.driverId;
  if (!driverId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const { documentTypes } = req.body;
  if (!Array.isArray(documentTypes) || documentTypes.length === 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "documentTypes array is required"
    );
  }

  const result = await DriverDocDetails.aggregate([
    { $match: { driverId } },
    {
      $project: {
        _id: 0,
        documents: {
          $filter: {
            input: "$documents",
            as: "doc",
            cond: { $in: ["$$doc.documentType", documentTypes] },
          },
        },
      },
    },
  ]);

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        result[0]?.documents || [],
        "Documents fetched"
      )
    );
});

const deleteDocumentByType = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(
      statusCode.UNAUTHORIZED,
      "Access token is missing or invalid"
    );
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded?.driverId;
  if (!driverId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const { documentType } = req.params;
  if (!documentType) {
    throw new ApiError(statusCode.BAD_REQUEST, "documentType is required in params");
  }

  const docEntry = await DriverDocDetails.findOne({ driverId });
  if (!docEntry) {
    throw new ApiError(statusCode.NOT_FOUND, "No documents found for this driver");
  }

  const originalLength = docEntry.documents.length;

  docEntry.documents = docEntry.documents.filter(
    (doc) => doc.documentType !== documentType
  );

  if (docEntry.documents.length === originalLength) {
    return res
      .status(statusCode.NOT_FOUND)
      .json(new ApiResponse(statusCode.NOT_FOUND, null, "Document not found"));
  }

  docEntry.updatedAt = new Date();
  await docEntry.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, { documentType }, "Document deleted successfully")
    );
});

module.exports = {
  uploadAvatar,
  updateDocumentByType,
  getDocumentsByTypes,
  deleteDocumentByType,
};

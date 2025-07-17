const statusCode = require("../../../utils/constants/statusCode");
const { decodeAccessToken } = require("../../../utils/jwtToken/customTokenService");
const ApiError = require("../../../utils/response/ApiError");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const DriverDocDetails=require('../../../models/new-driver-module/documents/driver-documents.model');
const { DriverDocEnum, DriverDocStatusEnum } = require("../../../utils/constants/ENUM");
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
    throw new ApiError(statusCode.UNAUTHORIZED, "Access token is missing or invalid");
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded?.driverId;
  if (!driverId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const { documentType, fileUrl, fileName } = req.body;
  if (!documentType || !fileUrl || !fileName) {
    throw new ApiError(statusCode.BAD_REQUEST, "documentType, fileUrl, fileName are required");
  }

  const docEntry = await DriverDocDetails.findOne({ driverId });
  if (!docEntry) {
    await DriverDocDetails.create({
      driverId,
      documents: [{
        documentType,
        fileUrl,
        fileName,
        status: DriverDocStatusEnum.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
    });
  } else {
    const docsMap = new Map();
    docEntry.documents.forEach((doc) => docsMap.set(doc.documentType, doc));

    const existingDoc = docsMap.get(documentType);

    if (existingDoc && existingDoc.status === DriverDocStatusEnum.APPROVED) {
      return res
        .status(statusCode.OK)
        .json(new ApiResponse(statusCode.OK, null, "Document is already approved"));
    }

    docsMap.set(documentType, {
      ...existingDoc,
      documentType,
      fileUrl,
      fileName,
      status: DriverDocStatusEnum.PENDING,
      updatedAt: new Date(),
      createdAt: existingDoc?.createdAt || new Date(),
    });

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
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, null, "Document updated successfully"));
});


const getDocumentsByTypes = catchAsyncError(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Access token is missing or invalid");
  }

  const accessToken = authHeader.split(" ")[1];
  const decoded = decodeAccessToken(accessToken);
  const driverId = decoded?.driverId;
  if (!driverId) {
    throw new ApiError(statusCode.UNAUTHORIZED, "Invalid token");
  }

  const { documentTypes } = req.body;
  if (!Array.isArray(documentTypes) || documentTypes.length === 0) {
    throw new ApiError(statusCode.BAD_REQUEST, "documentTypes array is required");
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
    .json(new ApiResponse(statusCode.OK, result[0]?.documents || [], "Documents fetched"));
});


module.exports = {
  uploadAvatar,
  updateDocumentByType,
  getDocumentsByTypes,
};

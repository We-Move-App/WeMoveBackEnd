const catchAsyncError = require("../../../utils/response/catchAsyncError");
const ApiError = require("../../../utils/response/ApiError");
const statusCode = require("../../../utils/constants/statusCode");
const logger = require("../../../utils/logger/logger");
const ApiResponse = require("../../../utils/response/ApiResponse");
const BusOperatorModel = require("../../../models/bus-module/bus-operator/bus-operator.model");
const Wallet = require("../../../models/wallet-module/wallets.model");
const {
  validateRequestBody,
} = require("../../../utils/reqFunctions/reqFunction");
const {
  saveDeviceToken,
  removeDeviceToken,
} = require("../../../utils/services/deviceToken.services");
const BusOperatorDeviceTokenModel = require("../../../models/bus-module/bus-operator-device-tokens/bus-operator-device-tokens.model");
const {
  BusOperatorBankModel,
} = require("../../../models/bus-module/bus-operator-banks/bus-operator-banks.model");
const {
  uploadSingleImageToAws,
} = require("../../../utils/uploadFiles/images/uploadImages");
const {
  BusOperatorDocumentModel,
} = require("../../../models/bus-module/bus-operator-documents/bus-operator-document.model");
const {
  uploadImageOnAws,
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");
const {
  DocumentsModel,
} = require("../../../models/global-module/documents/document.model");
const { TypeOfUser } = require("../../../utils/constants/constants");
const {
  registerUserWithEmailAndPhoneNumber,
  loginUserWithEmailAndPhoneNumber,
  logoutUserFunc,
  refreshTokenFunc,
  resendOtpFunc,
  verifyOtpFunc,
  checkUserVerificationStatus,
  addEmailOrPhoneNumberFunc,
  verifyOtpWithoutTokenFunc,
  resendOtpWithoutTokenFunc,
  verifyEmailExistFunc,
} = require("../../../utils/services/functions.services");
const ejs = require("ejs");
const path = require("path");
const generateUniqueCardNumber = require("../../../utils/customId/generateUniqueCardNumber");
const busOperatorHistoryModel = require("../../../models/bus-module/bus-operator/bus-operatorHistory.model");

// =====================|| REGISTER DRIVER ||==========================
const registerBusOperator = catchAsyncError(async (req, res, next) => {
  const result = await registerUserWithEmailAndPhoneNumber({
    req,
    res,
    reqModel: BusOperatorModel,
    typeOfUser: TypeOfUser.BUSOPERATOR,
  });

  // Populate branch before sending response
  if (result?.data?.user?._id) {
    const populatedUser = await BusOperatorModel.findById(result.data.user._id)
      .select("-password")
      .populate("branch");

    if (populatedUser) {
      result.data.user = populatedUser; // overwrite with populated version
    }
  }

  return res.status(statusCode.OK).json(result);
});

// =====================|| LOGIN USER ||=====================================
const loginBusOperator = catchAsyncError(async (req, res, next) => {
  const result = await loginUserWithEmailAndPhoneNumber({
    req,
    res,
    reqModel: BusOperatorModel,
    typeOfUser: TypeOfUser.BUSOPERATOR,
  });

  return res.status(statusCode.OK).json(result);
});

const verificationBusOperator = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const { identityCardNumber, businessLicenseNumber } = req.body;

  let docsToUpload = req.files;
  if (!docsToUpload || Object.keys(docsToUpload).length === 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "National ID card front and back sides are mandatory."
    );
  }
  const keys = Object.keys(req.files);
  const reqField = ["identityCardNumber", "businessLicenseNumber"];
  validateRequestBody(reqField, req.body);
  const [user, userDocs] = await Promise.all([
    BusOperatorModel.findById(_id),
    BusOperatorDocumentModel.findOne({ userId: _id }).populate("documentIds"),
  ]);

  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  const existingDocumentTypes = userDocs
    ? userDocs.documentIds.map((doc) => doc.documentType)
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

  const validDocumentTypes = [
    "national_identity_card_front",
    "national_identity_card_back",
  ];
  const invalidKeys = keys.filter((key) => !validDocumentTypes.includes(key));
  if (invalidKeys.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid document types: ${invalidKeys.join(", ")}`
    );
  }

  let docsIds = [];
  for (const key of keys) {
    const imgFile = docsToUpload[key][0];

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

  user.businessLicenseNumber = businessLicenseNumber;
  user.identityCardNumber = identityCardNumber;

  // Add new document IDs to the user's document list
  if (!userDocs) {
    // If no entry exists, create a new one
    await BusOperatorDocumentModel.create({
      userId: _id,
      documentIds: docsIds,
    });
  } else {
    // Update the existing entry
    userDocs.documentIds.push(...docsIds);
    await userDocs.save();
  }

  await user.save();

  const result = {};

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, result, `Added Successfully`));
});

const getVerificationDetails = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;

  const [isUserExist, documents] = await Promise.all([
    BusOperatorModel.findById(_id).select(
      "businessLicenseNumber identityCardNumber"
    ),
    BusOperatorDocumentModel.findOne({
      userId: _id,
    }).populate("documentIds"),
  ]);

  if (!isUserExist) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        { user: isUserExist, documents },
        `Details found`
      )
    );
});

const updateVerificationDetails = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const { identityCardNumber, businessLicenseNumber } = req.body;

  const docsToUpload = req.files || {};

  // Fetch user details
  let [user, userDocs] = await Promise.all([
    BusOperatorModel.findById(_id),
    BusOperatorDocumentModel.findOne({ userId: _id }).populate("documentIds"),
  ]);

  if (!user) {
    throw new ApiError(statusCode.NOT_FOUND, "User not found");
  }

  let updatedDocs = [];
  const keys = Object.keys(docsToUpload);

  if (keys.length > 0 && userDocs) {
    const validDocumentTypes = [
      "national_identity_card_front",
      "national_identity_card_back",
    ];

    const invalidKeys = keys.filter((key) => !validDocumentTypes.includes(key));
    if (invalidKeys.length > 0) {
      throw new ApiError(
        statusCode.BAD_REQUEST,
        `Invalid document types: ${invalidKeys.join(", ")}`
      );
    }

    for (const key of keys) {
      const imgFile = docsToUpload[key][0];

      // Find existing document
      let existingDoc = userDocs.documentIds.find(
        (doc) => doc.documentType === key
      );

      if (existingDoc) {
        // Delete old image
        if (existingDoc.file?.public_id) {
          await deleteImageFromAws(existingDoc.file.public_id);
        }

        // Upload new image
        const cloudImage = await uploadImageOnAws(
          imgFile.path,
          imgFile.originalname
        );
        existingDoc.file = {
          public_id: cloudImage?.public_id,
          url: cloudImage?.secure_url,
        };
        existingDoc.fileType = imgFile.mimetype;
        await existingDoc.save();
        updatedDocs.push(existingDoc);
      }
    }
  }

  // Update user details (even if no images were uploaded)
  user.businessLicenseNumber =
    businessLicenseNumber || user.businessLicenseNumber;
  user.identityCardNumber = identityCardNumber || user.identityCardNumber;
  await user.save();

  return res
    .status(statusCode.OK)
    .json(new ApiResponse(statusCode.OK, {}, "Updated Successfully"));
});

// =====================|| LOGOUT USER ||====================================
const logoutUser = catchAsyncError(async (req, res, next) => {
  const result = await logoutUserFunc({ req, res });

  return res.status(statusCode.OK).json(result);
});

// =====================|| REFRESH TOKEN ||==================================
const refreshToken = catchAsyncError(async (req, res, next) => {
  const result = await refreshTokenFunc({
    req,
    res,
    reqModel: BusOperatorModel,
    typeOfUser: TypeOfUser.BUSOPERATOR,
  });

  return res.status(statusCode.OK).json(result);
});

// =====================|| RESEND OTP ||=====================================
const resendOtp = catchAsyncError(async (req, res, next) => {
  const result = await resendOtpFunc({
    req,
    res,
    reqModel: BusOperatorModel,
  });
  // Send response indicating where the OTP was sent
  return res.status(statusCode.OK).json(result);
});
// =====================|| RESEND OTP WITHOUT TOKEN ||=====================================
const resendOtpWithoutToken = catchAsyncError(async (req, res, next) => {
  const result = await resendOtpWithoutTokenFunc({
    req,
    res,
    reqModel: BusOperatorModel,
  });
  // Send response indicating where the OTP was sent
  return res.status(statusCode.OK).json(result);
});

// =====================|| VERIFY OTP ||=====================================
const verifyOTP = catchAsyncError(async (req, res, next) => {
  const result = await verifyOtpFunc({
    req,
    res,
    reqModel: BusOperatorModel,
  });
  return res.status(statusCode.OK).json(result);
});

// =====================|| VERIFY OTP ||=====================================
const verifyOTPWithoutToken = catchAsyncError(async (req, res, next) => {
  const result = await verifyOtpWithoutTokenFunc({
    req,
    res,
    reqModel: BusOperatorModel,
  });
  return res.status(statusCode.OK).json(result);
});

// =====================|| CHECK YOUR APPLICATION STATUS ||======================
const verifyStatus = catchAsyncError(async (req, res, next) => {
  const result = await checkUserVerificationStatus({
    req,
    res,
    reqModel: BusOperatorModel,
  });
  return res.status(statusCode.OK).json(result);
});

// =====================|| ADD EMAIL  ||==================================
const addEmailOrPhone = catchAsyncError(async (req, res, next) => {
  const result = await addEmailOrPhoneNumberFunc({
    req,
    res,
    reqModel: BusOperatorModel,
    historyModel: busOperatorHistoryModel,
    req,
  });
  return res.status(statusCode.OK).json(result);
});

const saveDeviceTokens = catchAsyncError(async (req, res, next) => {
  const { token, deviceType } = req.body;

  const reqField = ["token", "deviceType"];
  validateRequestBody(reqField, req.body);

  const model = BusOperatorDeviceTokenModel;

  const response = await saveDeviceToken(
    req.user._id,
    token,
    deviceType,
    model
  );
  return res.status(statusCode.OK).json(response);
});
const removeDeviceTokens = catchAsyncError(async (req, res, next) => {
  const { token, deviceType } = req.body;

  const reqField = ["token", "deviceType"];
  validateRequestBody(reqField, req.body);

  const model = BusOperatorDeviceTokenModel;

  const response = await removeDeviceToken(
    req.user._id,
    token,
    deviceType,
    model
  );
  return res.status(statusCode.OK).json(response);
});

const verifyEmailExist = catchAsyncError(async (req, res, next) => {
  const result = await verifyEmailExistFunc({
    req,
    res,
    reqModel: BusOperatorModel,
  });

  return res.status(statusCode.OK).json(result);
});

module.exports = {
  loginBusOperator,
  logoutUser,
  refreshToken,
  registerBusOperator,
  resendOtp,
  verifyOTP,
  verifyStatus,
  addEmailOrPhone,
  removeDeviceTokens,
  saveDeviceTokens,
  verificationBusOperator,
  getVerificationDetails,
  updateVerificationDetails,
  verifyOTPWithoutToken,
  resendOtpWithoutToken,
  verifyEmailExist,
};

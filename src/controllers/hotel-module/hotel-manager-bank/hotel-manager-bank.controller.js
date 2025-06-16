const {
  HotelManagerBankModel,
} = require("../../../models/hotel-module/hotel-manager-banks/hotel-manager-banks.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const logger = require("../../../utils/logger/logger");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  uploadSingleImageToAws,
} = require("../../../utils/uploadFiles/images/uploadImages");
const {
  uploadImageOnAws,
  deleteImageFromAws,
} = require("../../../utils/uploadFiles/uploadFilestoAws");

const createBankDetails = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;

  const {
    accountHolderName,
    accountNumber,
    bankName,
    // ifscCode,
    // branchName,
    // phoneNumber,
    isPrimary = true,
  } = req.body;

  const docsToUpload = req.files;
  if (!docsToUpload || Object.keys(docsToUpload).length === 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Bank account details files are mandatory"
    );
  }

  const keys = Object.keys(req.files);

  if (!accountNumber?.trim() ) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "All fields are required: accountNumber & ifscCode"
    );
  }

  const existingBank = await HotelManagerBankModel.findOne({
    userId: _id,
  });

  if (existingBank) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Bank already exists for the user."
    );
  }

  const validDocumentTypes = ["bank_detail"];
  const invalidKeys = keys.filter((key) => !validDocumentTypes.includes(key));

  if (invalidKeys.length > 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      `Invalid document types: ${invalidKeys.join(", ")}`
    );
  }

  const imgUpload = docsToUpload["bank_detail"];
   const uploadImage = await uploadSingleImageToAws(imgUpload);
  const addBankDetail = new HotelManagerBankModel({
    accountHolderName,
    accountNumber,
    bankName,
    // ifscCode,
    // branchName,
    // phoneNumber,
    isPrimary,
    userId: _id,
    bankDocs: uploadImage,
    isPrimary: isPrimary,
  });

  if (!addBankDetail) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Error occurred while adding bank detail"
    );
  }
  await addBankDetail.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        addBankDetail,
        `Bank details added successfully`
      )
    );
});

const getBankDetails = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;

  const userBank = await HotelManagerBankModel.findOne({
    userId: _id,
  });

  if (!userBank) {
    return next(new ApiError(statusCode.NOT_FOUND, "Bank detail(s) not found"));
  }
  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(statusCode.OK, { bank: userBank }, "Bank data found")
    );
});

const updateBankDetails = catchAsyncError(async (req, res, next) => {
  const { _id } = req.user;
  const {
    accountHolderName,
    accountNumber,
    bankName,
    // ifscCode,
    // branchName,
    // phoneNumber,
    isPrimary,
  } = req.body;
  const docsToUpload = req.files;

  const findBank = await HotelManagerBankModel.findOne({ userId: _id });
  if (!findBank) {
    throw new ApiError(statusCode.NOT_FOUND, "Bank details not found.");
  }

  // Update bank details
  findBank.accountHolderName = accountHolderName;
  findBank.accountNumber = accountNumber;
  findBank.bankName = bankName;
  // findBank.ifscCode = ifscCode;
  // findBank.branchName = branchName;
  // findBank.phoneNumber = phoneNumber;
  findBank.isPrimary = isPrimary;

  if (docsToUpload && Object.keys(docsToUpload).length > 0) {
    if (findBank.bankDocs?.public_id) {
      await deleteImageFromAws(findBank.bankDocs?.public_id);
    }
    const imgUpload = docsToUpload["bank_detail"];
    const uploadImage = await uploadSingleImageToAws(imgUpload);
    findBank.bankDocs = uploadImage;
  }

  // Ensure only one primary bank
  // if (isPrimary) {
  //   await HotelManagerBankModel.updateMany(
  //     { userId: _id },
  //     { isPrimary: false }
  //   );
  //   findBank.isPrimary = true;
  // }

  // Save updated bank details
  const updatedBankDetail = await findBank.save();

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        updatedBankDetail,
        "Bank details updated successfully."
      )
    );
});

const deleteBankDetails = catchAsyncError(async (req, res, next) => {
  const id = req.params.id;

  const findBank = await HotelManagerBankModel.findOne({ _id: id });

  if (!findBank) {
    throw new ApiError(statusCode.NOT_FOUND, "Bank details not found.");
  }

  if (findBank?.bankDocs?.public_id) {
    try {
      await deleteImageFromAws(findBank.bankDocs.public_id);
    } catch (error) {
      console.error(`Failed to delete attached file for bank details ID: ${id}:`, error);
    }
  }

  await HotelManagerBankModel.findOneAndDelete({ _id: id });

  return res.status(statusCode.OK).json(
    new ApiResponse(statusCode.OK, {}, "Bank details and attached file deleted successfully.")
  );
});


module.exports = {
  createBankDetails,
  getBankDetails,
  updateBankDetails,
  deleteBankDetails,
};

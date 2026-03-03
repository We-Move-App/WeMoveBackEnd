const statusCode = require("../constants/statusCode");
const ApiError = require("../response/ApiError");
const ApiResponse = require("../response/ApiResponse");
const {
  uploadSingleImageToAws,
} = require("../uploadFiles/images/uploadImages");
const { deleteImageFromAws } = require("../uploadFiles/uploadFilestoAws");
const { translateLn } = require("./translator.service");
const { fetchLn } = require("./user.services");

const addBankFuncs = async ({ req, res, reqModel }) => {
  const { _id } = req.user;
  const {
    accountHolderName,
    accountNumber,
    bankName,
    ifscCode,
    branchName,
    phoneNumber,
    isPrimary = true,
  } = req.body;

  const ln = fetchLn(_id);

  const docsToUpload = req.files;
  if (!docsToUpload || Object.keys(docsToUpload).length === 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "BANK_FILES_REQUIRED")
    );
  }
  const keys = Object.keys(req.files);

  if (!accountNumber) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "ACCOUNT_NUMBER_REQUIRED")
    );
  }
  const existingBank = await reqModel.findOne({ userId: _id });
  if (existingBank) {
    throw new ApiError(
      statusCode.CONFLICT,
      translateLn(ln, "BANK_ALREADY_EXISTS")
    );
  }

  const existingAccountNumber = await reqModel.findOne({ accountNumber });
  if (existingAccountNumber) {
    throw new ApiError(
      statusCode.CONFLICT,
      translateLn(ln, "ACCOUNT_NUMBER_EXISTS")
    );
  }
  const validDocumentTypes = ["bank_detail"];
  const invalidKeys = keys.filter((key) => !validDocumentTypes.includes(key));

  if (invalidKeys.length > 0) {
    const baseMessage = translateLn(ln, "INVALID_DOCUMENT_TYPES");

    throw new ApiError(
      statusCode.BAD_REQUEST,
      `${baseMessage}: ${invalidKeys.join(", ")}`
    );
  }

  const imgUpload = docsToUpload["bank_detail"];
  const uploadImage = await uploadSingleImageToAws(imgUpload);
  const addBankDetail = new reqModel({
    accountHolderName,
    accountNumber,
    bankName,
    ifscCode,
    branchName,
    phoneNumber,
    isPrimary,
    userId: _id,
    bankDocs: uploadImage,
    isPrimary: isPrimary,
  });

  if (!addBankDetail) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      translateLn(ln, "BANK_ADD_ERROR")
    );
  }
  await addBankDetail.save();

  // Ensure only one primary bank
  // if (isPrimary) {
  //   await BusOperatorBankModel.updateMany(
  //     { userId: _id },
  //     { isPrimary: false }
  //   );
  //   findBank.isPrimary = true;
  // }

  // Save updated bank details

  return new ApiResponse(
    statusCode.OK,
    addBankDetail,
    translateLn(ln, "BANK_ADDED_SUCCESS")
  );
};
const addBankFuncsByAdmin = async ({ req, res, reqModel }) => {
  const {
    accountHolderName,
    accountNumber,
    bankName,
    ifscCode,
    branchName,
    phoneNumber,
    isPrimary = true,
    busOperatorId, // passed in body or query
  } = req.body;

  if (!busOperatorId) {
    throw new ApiError(statusCode.BAD_REQUEST, "busOperatorId is required");
  }

  const docsToUpload = req.files;
  if (!docsToUpload || Object.keys(docsToUpload).length === 0) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Bank account details files are mandatory"
    );
  }

  const keys = Object.keys(req.files);

  if (!accountNumber) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "All fields are required: accountNumber"
    );
  }

  const existingBank = await reqModel.findOne({ userId: busOperatorId });
  if (existingBank) {
    throw new ApiError(
      statusCode.CONFLICT,
      "This Bus Operator already has a registered bank account."
    );
  }

  const existingAccountNumber = await reqModel.findOne({ accountNumber });
  if (existingAccountNumber) {
    throw new ApiError(
      statusCode.CONFLICT,
      "This account number is already registered."
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

  const addBankDetail = new reqModel({
    accountHolderName,
    accountNumber,
    bankName,
    ifscCode,
    branchName,
    phoneNumber,
    isPrimary,
    userId: busOperatorId,
    bankDocs: uploadImage,
  });

  if (!addBankDetail) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      "Error occurred while adding bank detail"
    );
  }

  await addBankDetail.save();

  return new ApiResponse(
    statusCode.OK,
    addBankDetail,
    `Bank details added successfully`
  );
};

const getBanksFuncs = async ({ req, res, reqModel }) => {
  const { _id } = req.user;
  const userBank = await reqModel.findOne({
    userId: _id,
  });

  const ln = await fetchLn(_id);

  if (!userBank) {
    throw new ApiError(statusCode.NOT_FOUND, translateLn(ln, "BANK_NOT_FOUND"));
  }
  return new ApiResponse(
    statusCode.OK,
    { bank: userBank },
    translateLn(ln, "BANK_FOUND")
  );
};

const deleteBankFunc = async ({ req, res, reqModel }) => {
  const id = req.params.id;

  // Check if bank details exist and delete
  const findBank = await reqModel.findOneAndDelete({
    _id: id,
  });

  if (findBank?.bankDocs?.public_id) {
    await deleteImageFromAws(findBank.bankDocs?.public_id);
  }

  if (!findBank) {
    throw new ApiError(statusCode.NOT_FOUND, translateLn(ln, "BANK_NOT_FOUND"));
  }
  return new ApiResponse(statusCode.OK, {}, translateLn(ln, "BANK_DELETED"));
};

const updateBankFunc = async ({ req, res, reqModel }) => {
  const { _id } = req.user;
  const {
    accountHolderName,
    accountNumber,
    bankName,
    ifscCode,
    branchName,
    phoneNumber,
    isPrimary,
  } = req.body;
  const ln = await fetchLn(_id);

  const docsToUpload = req.files;
  const findBank = await reqModel.findOne({ userId: _id });
  if (!findBank) {
    throw new ApiError(statusCode.NOT_FOUND, translateLn(ln, "BANK_NOT_FOUND"));
  }

  // ✅ Check if the account number is already registered by another user
  if (accountNumber && accountNumber !== findBank.accountNumber) {
    const existingAccount = await reqModel.findOne({ accountNumber });
    if (existingAccount) {
      throw new ApiError(
        statusCode.CONFLICT,
        translateLn(ln, "ACCOUNT_NUMBER_EXISTS")
      );
    }
  }

  findBank.accountHolderName = accountHolderName || findBank.accountHolderName;
  findBank.accountNumber = accountNumber || findBank.accountNumber;
  findBank.bankName = bankName || findBank.bankName;
  findBank.ifscCode = ifscCode || findBank.ifscCode;
  findBank.branchName = branchName || findBank.branchName;
  findBank.phoneNumber = phoneNumber || findBank.phoneNumber;
  findBank.isPrimary = isPrimary ?? findBank.isPrimary;

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
  //   await BusOperatorBankModel.updateMany(
  //     { userId: _id },
  //     { isPrimary: false }
  //   );
  //   findBank.isPrimary = true;
  // }

  // Save updated bank details
  const updatedBankDetail = await findBank.save();

  return new ApiResponse(
    statusCode.OK,
    updatedBankDetail,
    translateLn(ln, "BANK_UPDATED")
  );
};

module.exports = {
  addBankFuncsByAdmin,
  addBankFuncs,
  getBanksFuncs,
  deleteBankFunc,
  updateBankFunc,
};

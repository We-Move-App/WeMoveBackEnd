const {
  BusOperatorBankModel,
} = require("../../../models/bus-module/bus-operator-banks/bus-operator-banks.model");
const statusCode = require("../../../utils/constants/statusCode");
const logger = require("../../../utils/logger/logger");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  addBankFuncs,
  getBanksFuncs,
  deleteBankFunc,
  updateBankFunc,
} = require("../../../utils/services/banksFunc.services");

const createBankDetails = catchAsyncError(async (req, res, next) => {
  const result = await addBankFuncs({
    req,
    res,
    reqModel: BusOperatorBankModel,
  });

  return res.status(statusCode.OK).json(result);
});

const getBankDetails = catchAsyncError(async (req, res, next) => {
  const result = await getBanksFuncs({
    req,
    res,
    reqModel: BusOperatorBankModel,
  });
  return res.status(statusCode.OK).json(result);
});

const updateBankDetails = catchAsyncError(async (req, res, next) => {
  const result = await updateBankFunc({
    req,
    res,
    reqModel: BusOperatorBankModel,
  });

  return res.status(statusCode.OK).json(result);
});

const deleteBankDetails = catchAsyncError(async (req, res, next) => {
  logger.info("deleting bank details...");

  const result = await deleteBankFunc({
    req,
    res,
    reqModel: BusOperatorBankModel,
  });
  return res.status(statusCode.OK).json(result);
});

module.exports = {
  createBankDetails,
  getBankDetails,
  updateBankDetails,
  deleteBankDetails,
};

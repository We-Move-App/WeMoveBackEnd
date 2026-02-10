const Commission = require("../../../models/admin-module/commission-management/commission.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  createCommissionValidation,
  updateCommissionValidation,
} = require("./commission.validation");

const createCommission = catchAsyncError(async (req, res) => {
  const { error, value } = createCommissionValidation.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      error.details.map((d) => d.message).join(", ")
    );
  }

 
  const existing = await Commission.findOne({ serviceType: value.serviceType });
  if (existing) {
    throw new ApiError(
      statusCode.CONFLICT,
      `Commission for ${value.serviceType} already exists`
    );
  }

  const commission = await Commission.create(value);

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        commission,
        "Commission created successfully"
      )
    );
});

const getAllCommissions = catchAsyncError(async (req, res) => {
  const commissions = await Commission.find().sort({ serviceType: 1 }); // sort by serviceType for consistency

  if (!commissions || commissions.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, "No commissions found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        commissions,
        "Commissions fetched successfully"
      )
    );
});

const getCommissionById = catchAsyncError(async (req, res) => {
  const { commissionId } = req.params;

  const commission = await Commission.findById(commissionId);
  if (!commission) {
    throw new ApiError(statusCode.NOT_FOUND, `Commission not found`);
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        commission,
        `Commission fetched successfully`
      )
    );
});

const updateCommission = catchAsyncError(async (req, res) => {
  const { commissionId } = req.params;

  const { error, value } = updateCommissionValidation.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      error.details.map((d) => d.message).join(", ")
    );
  }

  if (value.commissionType === "percentage") {
    value.commissionRate = null;
  }
  if (value.commissionType === "fixed") {
    value.commissionPercentage = null;
  }

  const commission = await Commission.findByIdAndUpdate(
    commissionId,
    { $set: value },
    { new: true, runValidators: true }
  );

  if (!commission) {
    throw new ApiError(statusCode.NOT_FOUND, "Commission not found");
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        commission,
        "Commission updated successfully"
      )
    );
});

module.exports = {
  createCommission,
  getAllCommissions,
  getCommissionById,
  updateCommission,
};

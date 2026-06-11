const Commission = require("../../../models/admin-module/commission-management/commission.model");
const statusCode = require("../../../utils/constants/statusCode");
const ApiError = require("../../../utils/response/ApiError");
const ApiResponse = require("../../../utils/response/ApiResponse");
const catchAsyncError = require("../../../utils/response/catchAsyncError");
const {
  createCommissionValidation,
  updateCommissionValidation,
} = require("./commission.validation");
const { fetchAdminLn } = require("../../../utils/services/user.services");
const { translateLn } = require("../../../utils/services/translator.service");

const serviceTypeMap = {
  bike: "BIKE",
  bus: "BUS",
  hotel: "HOTEL",
  taxi: "TAXI",
  user: "USER",
};

const statusMap = {
  active: "ACTIVE",
  in_active: "INACTIVE",
};

const createCommission = catchAsyncError(async (req, res) => {
  const ln = (req.headers["ln"] || "en").toLowerCase();

  const { error, value } = createCommissionValidation.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      error.details.map((d) => translateLn(ln, d.message)).join(", ")
    );
  }

  const existing = await Commission.findOne({
    serviceType: value.serviceType,
  });

  if (existing) {
    throw new ApiError(
      statusCode.CONFLICT,
      `${translateLn(ln, "COMMISSION_ALREADY_EXISTS_FOR")} ${translateLn(
        ln,
        serviceTypeMap[value.serviceType?.toLowerCase()] || value.serviceType
      )}`
    );
  }

  const commission = await Commission.create(value);

  return res
    .status(statusCode.CREATED)
    .json(
      new ApiResponse(
        statusCode.CREATED,
        commission,
        translateLn(ln, "COMMISSION_CREATED_SUCCESS")
      )
    );
});

const getAllCommissions = catchAsyncError(async (req, res) => {
  const ln = (req.headers["ln"] || "en").toLowerCase();

  const commissions = await Commission.find().sort({ serviceType: 1 });

  if (!commissions || commissions.length === 0) {
    throw new ApiError(statusCode.NOT_FOUND, translateLn(ln, "NO_COMMISSIONS"));
  }

  const data = commissions.map((item) => ({
    ...item._doc,

    serviceType: translateLn(
      ln,
      serviceTypeMap[item.serviceType?.toLowerCase()] || item.serviceType
    ),

    status: item.status,
  }));

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        data,
        translateLn(ln, "COMMISSION_FETCHED")
      )
    );
});

const getCommissionById = catchAsyncError(async (req, res) => {
  const ln = (req.headers["ln"] || "en").toLowerCase();
  const { commissionId } = req.params;

  const commission = await Commission.findById(commissionId);

  if (!commission) {
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "COMMISSION_NOT_FOUND")
    );
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        commission,
        translateLn(ln, "COMMISSION_FETCHED")
      )
    );
});

// const updateCommission = catchAsyncError(async (req, res) => {
//   const { commissionId } = req.params;

//   const { error, value } = updateCommissionValidation.validate(req.body, {
//     abortEarly: false,
//     stripUnknown: true,
//   });

//   if (error) {
//     throw new ApiError(
//       statusCode.BAD_REQUEST,
//       error.details.map((d) => d.message).join(", ")
//     );
//   }

//   if (value.commissionType === "percentage") {
//     value.commissionRate = null;
//   }
//   if (value.commissionType === "fixed") {
//     value.commissionPercentage = null;
//   }

//   const commission = await Commission.findByIdAndUpdate(
//     commissionId,
//     { $set: value },
//     { new: true, runValidators: true }
//   );

//   if (!commission) {
//     throw new ApiError(statusCode.NOT_FOUND, "Commission not found");
//   }

//   return res
//     .status(statusCode.OK)
//     .json(
//       new ApiResponse(
//         statusCode.OK,
//         commission,
//         "Commission updated successfully"
//       )
//     );
// });

const updateCommission = catchAsyncError(async (req, res) => {
  const ln = (req.headers["ln"] || "en").toLowerCase();

  const { commissionId } = req.params;

  const { error, value } = updateCommissionValidation.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new ApiError(
      statusCode.BAD_REQUEST,
      error.details.map((d) => translateLn(ln, d.message)).join(", ")
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
    throw new ApiError(
      statusCode.NOT_FOUND,
      translateLn(ln, "COMMISSION_NOT_FOUND")
    );
  }

  return res
    .status(statusCode.OK)
    .json(
      new ApiResponse(
        statusCode.OK,
        commission,
        translateLn(ln, "COMMISSION_UPDATED_SUCCESS")
      )
    );
});

module.exports = {
  createCommission,
  getAllCommissions,
  getCommissionById,
  updateCommission,
};

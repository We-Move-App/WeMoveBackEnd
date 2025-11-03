const Joi = require("joi");
const {
  CommissionServiceTypeEnum,
  CommissionTypeEnum,
  CommissionStatusEnum,
} = require("../../../utils/constants/ENUM");

const createCommissionValidation = Joi.object({
  serviceType: Joi.string()
    .valid(...Object.values(CommissionServiceTypeEnum))
    .required(),

  commissionType: Joi.string()
    .valid(...Object.values(CommissionTypeEnum))
    .required(),

  commissionPercentage: Joi.number().min(0).max(100).when("commissionType", {
    is: CommissionTypeEnum.PERCENTAGE,
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),

  commissionRate: Joi.number().positive().when("commissionType", {
    is: CommissionTypeEnum.FIXED,
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),

  status: Joi.string()
    .valid(...Object.values(CommissionStatusEnum))
    .default(CommissionStatusEnum.ACTIVE),
});

const updateCommissionValidation = Joi.object({
  serviceType: Joi.forbidden(),

  commissionType: Joi.string().valid(...Object.values(CommissionTypeEnum)),

  commissionPercentage: Joi.number().min(0).max(100).when("commissionType", {
    is: CommissionTypeEnum.PERCENTAGE,
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),

  commissionRate: Joi.number().positive().when("commissionType", {
    is: CommissionTypeEnum.FIXED,
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),

  startDate: Joi.date(),
  endDate: Joi.date().greater(Joi.ref("startDate")),

  status: Joi.string().valid(...Object.values(CommissionStatusEnum)),
}).min(1);

module.exports = { createCommissionValidation, updateCommissionValidation };
